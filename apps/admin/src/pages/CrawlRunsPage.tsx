import { useMemo, useState } from 'react';
import type { CrawlRun } from '../api/types.ts';
import { type Column, DataTable } from '../components/DataTable.tsx';
import { IconRefresh } from '../components/icons.tsx';
import { HoverTip, SearchInput, Segmented, StatusBadge, formatDateTime, timeAgo } from '../components/ui.tsx';
import { useResource } from '../lib/useResource.ts';

export function CrawlRunsPage() {
  const runs = useResource<CrawlRun[]>('/admin/v1/crawl-runs?limit=200');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'ok' | 'failed' | 'quarantined'>('all');

  const rows = useMemo(() => {
    let list = runs.data ?? [];
    if (status !== 'all') list = list.filter((r) => r.status === status);
    return list;
  }, [runs.data, status]);

  const columns: Column<CrawlRun>[] = [
    {
      key: 'started_at',
      header: 'Thời điểm',
      sortValue: (r) => r.started_at,
      render: (r) => (
        <HoverTip
          label={timeAgo(r.started_at)}
          rows={[
            ['Chính xác', formatDateTime(r.started_at)],
            ['Config ver', r.config_version],
          ]}
        />
      ),
    },
    { key: 'source_id', header: 'Nguồn', searchText: (r) => `${r.source_id} ${r.status}` },
    {
      key: 'status',
      header: 'Kết quả',
      render: (r) =>
        r.error ? (
          <HoverTip label={<StatusBadge status={r.status} />} rows={[['Lỗi', r.error]]} />
        ) : (
          <StatusBadge status={r.status} />
        ),
    },
    { key: 'rows_parsed', header: 'Dòng đọc', numeric: true },
    { key: 'rows_changed', header: 'Dòng đổi', numeric: true },
    {
      key: 'duration_ms',
      header: 'Thời gian',
      numeric: true,
      sortValue: (r) => r.duration_ms ?? 0,
      render: (r) => (r.duration_ms != null ? `${r.duration_ms}ms` : '—'),
    },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Nhật ký crawl</h2>
          <div className="sub">Lịch sử thu thập giá — dùng để theo dõi sức khỏe từng nguồn</div>
        </div>
        <div className="actions">
          <button className="btn sm" onClick={() => runs.reload()}>
            <IconRefresh size={15} />
            Làm mới
          </button>
        </div>
      </div>

      {runs.error && <p className="error">{runs.error}</p>}

      <div className="card">
        <div className="toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder="Tìm theo nguồn…" />
          <Segmented
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all', label: 'Tất cả' },
              { value: 'ok', label: 'OK' },
              { value: 'quarantined', label: 'Cách ly' },
              { value: 'failed', label: 'Lỗi' },
            ]}
          />
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => String(r.id)}
          search={search}
          initialSort={{ key: 'started_at', dir: 'desc' }}
          empty="Chưa có lần crawl nào."
        />
      </div>
    </>
  );
}
