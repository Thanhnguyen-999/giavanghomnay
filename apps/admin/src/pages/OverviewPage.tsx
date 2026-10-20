import type { CrawlRun, Review, Source } from '../api/types.ts';
import { useResource } from '../lib/useResource.ts';

function timeAgo(unixSec: number): string {
  const diff = Math.floor(Date.now() / 1000) - unixSec;
  if (diff < 60) return 'vừa xong';
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  return new Date(unixSec * 1000).toLocaleString('vi-VN');
}

/// Lần crawl gần nhất của mỗi nguồn (crawl-runs đã sắp xếp started_at DESC).
function latestBySource(runs: CrawlRun[]): Map<string, CrawlRun> {
  const map = new Map<string, CrawlRun>();
  for (const r of runs) {
    if (!map.has(r.source_id)) map.set(r.source_id, r);
  }
  return map;
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

  return (
    <>
      <h2>Tổng quan</h2>
      {err && <p className="error">{err}</p>}

      <div className="stat-grid">
        <StatCard
          label="Nguồn đang bật"
          value={enabled.length}
          hint={`${srcList.length} nguồn tổng cộng`}
          href="#sources"
        />
        <StatCard
          label="Nguồn lỗi"
          value={failing.length}
          tone={failing.length > 0 ? 'err' : 'ok'}
          hint={failing.length > 0 ? 'cần kiểm tra' : 'tất cả ổn'}
          href="#crawl-runs"
        />
        <StatCard
          label="Giá chờ duyệt"
          value={pendingReviews}
          tone={pendingReviews > 0 ? 'warn' : 'ok'}
          hint={pendingReviews > 0 ? 'cần kiểm duyệt' : 'không có'}
          href="#reviews"
        />
        <StatCard
          label="Nguồn chưa cấu hình"
          value={needsConfig.length}
          tone={needsConfig.length > 0 ? 'warn' : 'ok'}
          hint="chưa có config active"
          href="#sources"
        />
      </div>

      <div className="card">
        <h3>Tình trạng nguồn</h3>
        {srcList.length === 0 ? (
          <p className="muted">
            Chưa có nguồn nào. Thêm nguồn ở mục <a href="#sources">Nguồn dữ liệu</a>.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nguồn</th>
                <th>Loại</th>
                <th>Trạng thái</th>
                <th>Lần crawl gần nhất</th>
                <th>Kết quả</th>
              </tr>
            </thead>
            <tbody>
              {srcList.map((s) => {
                const run = latest.get(s.id);
                return (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>{s.kind}</td>
                    <td>
                      <span className={`badge ${s.enabled ? 'ok' : ''}`}>
                        {s.enabled ? 'Bật' : 'Tắt'}
                      </span>
                    </td>
                    <td className="muted">{run ? timeAgo(run.started_at) : 'chưa chạy'}</td>
                    <td>
                      {run ? (
                        <span
                          className={`badge ${run.status === 'ok' ? 'ok' : run.status === 'failed' ? 'err' : ''}`}
                        >
                          {run.status}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone,
  href,
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: 'ok' | 'warn' | 'err';
  href?: string;
}) {
  const content = (
    <div className={`stat-card ${tone ?? ''}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
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
