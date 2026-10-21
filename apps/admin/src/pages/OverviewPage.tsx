import { type ReactNode, useEffect, useState } from 'react';
import { api } from '../api/client.ts';
import type { CrawlRun, Product, Review, Source } from '../api/types.ts';
import { IconAlert, IconFeed, IconGauge, IconRefresh } from '../components/icons.tsx';
import { TrendChart, type TrendPoint } from '../components/TrendChart.tsx';
import { HoverTip, Spinner, StatusBadge, formatVnd, timeAgo } from '../components/ui.tsx';
import { useResource } from '../lib/useResource.ts';

function latestBySource(runs: CrawlRun[]): Map<string, CrawlRun> {
  const map = new Map<string, CrawlRun>();
  for (const r of runs) if (!map.has(r.source_id)) map.set(r.source_id, r);
  return map;
}

interface HistoryRow {
  day?: string;
  recorded_at?: number;
  close_sell?: number;
  sell?: number;
}

export function OverviewPage() {
  const sources = useResource<Source[]>('/admin/v1/sources');
  const reviews = useResource<Review[]>('/admin/v1/reviews?status=pending');
  const runs = useResource<CrawlRun[]>('/admin/v1/crawl-runs?limit=100');

  const srcList = sources.data ?? [];
  const enabled = srcList.filter((s) => s.enabled === 1);
  const needsConfig = srcList.filter((s) => s.active_config_version === null);
  const latest = latestBySource(runs.data ?? []);
  const failing = enabled.filter((s) => latest.get(s.id)?.status === 'failed');
  const pendingReviews = reviews.data?.length ?? 0;
  const err = sources.error ?? reviews.error ?? runs.error;

  const loading = sources.loading && !sources.data;

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Bảng điều khiển</h2>
          <div className="sub">Tổng quan tình trạng hệ thống giá vàng</div>
        </div>
        <div className="actions">
          <button
            className="btn sm"
            onClick={() => {
              sources.reload();
              reviews.reload();
              runs.reload();
            }}
          >
            <IconRefresh size={15} />
            Làm mới
          </button>
        </div>
      </div>

      {err && <p className="error">{err}</p>}
      {loading ? (
        <Spinner />
      ) : (
        <>
          <div className="stat-grid">
            <StatCard
              icon={<IconFeed />}
              label="Nguồn đang bật"
              value={enabled.length}
              hint={`${srcList.length} nguồn tổng cộng`}
              href="#sources"
            />
            <StatCard
              icon={<IconAlert />}
              label="Nguồn lỗi"
              value={failing.length}
              tone={failing.length > 0 ? 'err' : 'ok'}
              hint={failing.length > 0 ? 'cần kiểm tra ngay' : 'tất cả đang ổn'}
              href="#crawl-runs"
            />
            <StatCard
              icon={<IconAlert />}
              label="Giá chờ duyệt"
              value={pendingReviews}
              tone={pendingReviews > 0 ? 'warn' : 'ok'}
              hint={pendingReviews > 0 ? 'cần kiểm duyệt' : 'không có mục nào'}
              href="#reviews"
            />
            <StatCard
              icon={<IconGauge />}
              label="Nguồn chưa cấu hình"
              value={needsConfig.length}
              tone={needsConfig.length > 0 ? 'warn' : 'ok'}
              hint="chưa có cấu hình active"
              href="#sources"
            />
          </div>

          <PriceTrendCard />

          <div className="card">
            <div className="card-head">
              <h3>Tình trạng nguồn</h3>
              <div className="actions">
                <a className="btn sm ghost" href="#sources">
                  Quản lý nguồn
                </a>
              </div>
            </div>
            {srcList.length === 0 ? (
              <p className="muted">
                Chưa có nguồn nào. Thêm nguồn ở mục <a href="#sources">Nguồn dữ liệu</a>.
              </p>
            ) : (
              <div className="table-wrap" style={{ border: 'none' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Nguồn</th>
                      <th>Loại</th>
                      <th>Trạng thái</th>
                      <th>Crawl gần nhất</th>
                      <th>Kết quả</th>
                    </tr>
                  </thead>
                  <tbody>
                    {srcList.map((s) => {
                      const run = latest.get(s.id);
                      return (
                        <tr key={s.id}>
                          <td>
                            <HoverTip
                              label={s.name}
                              rows={[
                                ['Mã nguồn', s.id],
                                ['Chu kỳ', `${s.interval_sec}s`],
                                ['Config', s.active_config_version ?? 'chưa có'],
                                ['Điều khoản', s.terms_checked ? 'đã kiểm tra' : 'chưa'],
                              ]}
                            />
                          </td>
                          <td>
                            <span className="badge plain">{s.kind}</span>
                          </td>
                          <td>
                            <span className={`badge ${s.enabled ? 'ok' : 'plain'}`}>
                              {s.enabled ? 'Bật' : 'Tắt'}
                            </span>
                          </td>
                          <td className="muted">{run ? timeAgo(run.started_at) : 'chưa chạy'}</td>
                          <td>
                            {run ? (
                              <HoverTip
                                label={<StatusBadge status={run.status} />}
                                rows={[
                                  ['Dòng đọc', run.rows_parsed],
                                  ['Dòng đổi', run.rows_changed],
                                  ['Thời gian', run.duration_ms ? `${run.duration_ms}ms` : '—'],
                                  ['Lỗi', run.error ?? 'không'],
                                ]}
                              />
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

/// Biểu đồ lịch sử giá của một sản phẩm (chọn được), lấy từ /v1/prices/:id/history.
function PriceTrendCard() {
  const products = useResource<Product[]>('/admin/v1/products');
  const list = (products.data ?? []).filter((p) => p.active);
  const [pid, setPid] = useState<string>('');
  const [range, setRange] = useState<'1w' | '1m' | '3m' | '1y'>('1m');
  const [series, setSeries] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(false);

  const current = pid || list[0]?.id || '';

  useEffect(() => {
    if (!current) return;
    let cancelled = false;
    setLoading(true);
    api
      .get<HistoryRow[]>(`/v1/prices/${current}/history?range=${range}`)
      .then((rows) => {
        if (cancelled) return;
        setSeries(
          rows.map((r) => {
            const t = r.recorded_at ?? (r.day ? Date.parse(`${r.day}T00:00:00+07:00`) / 1000 : 0);
            const v = r.close_sell ?? r.sell ?? 0;
            return {
              t,
              v,
              label: r.day ?? new Date((r.recorded_at ?? 0) * 1000).toLocaleString('vi-VN'),
            };
          }),
        );
      })
      .catch(() => !cancelled && setSeries([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [current, range]);

  return (
    <div className="card">
      <div className="card-head">
        <h3>Diễn biến giá bán</h3>
        <div className="actions">
          <select
            value={current}
            onChange={(e) => setPid(e.target.value)}
            style={{ width: 'auto', height: 30 }}
            aria-label="Chọn sản phẩm"
          >
            {list.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <div className="seg">
            {(['1w', '1m', '3m', '1y'] as const).map((r) => (
              <button key={r} className={r === range ? 'active' : ''} onClick={() => setRange(r)}>
                {r === '1w' ? '1 tuần' : r === '1m' ? '1 tháng' : r === '3m' ? '3 tháng' : '1 năm'}
              </button>
            ))}
          </div>
        </div>
      </div>
      {loading ? (
        <Spinner />
      ) : series.length >= 2 ? (
        <>
          <TrendChart series={series} />
          <div className="muted" style={{ marginTop: 8 }}>
            Mới nhất: <strong className="mono">{formatVnd(series[series.length - 1]!.v)} đ/lượng</strong> ·{' '}
            {series.length} điểm dữ liệu
          </div>
        </>
      ) : (
        <p className="muted">
          Chưa đủ dữ liệu lịch sử cho sản phẩm này. Biểu đồ sẽ hiện khi giá thay đổi qua nhiều lần crawl.
        </p>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
  tone,
  href,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  hint?: string;
  tone?: 'ok' | 'warn' | 'err';
  href?: string;
}) {
  const content = (
    <div className={`stat-card ${tone ?? ''}`}>
      <div className="stat-top">
        {icon}
        {label}
      </div>
      <div className="stat-value">{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
  return href ? (
    <a href={href} className="stat-link">
      {content}
    </a>
  ) : (
    content
  );
}
