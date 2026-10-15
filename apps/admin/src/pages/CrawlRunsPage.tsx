import type { CrawlRun } from '../api/types.ts';
import { useResource } from '../lib/useResource.ts';

function ago(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleString('vi-VN');
}

export function CrawlRunsPage() {
  const runs = useResource<CrawlRun[]>('/admin/v1/crawl-runs?limit=100');

  return (
    <>
      <h2>Nhật ký crawl</h2>
      {runs.error && <p className="error">{runs.error}</p>}
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Thời điểm</th>
              <th>Nguồn</th>
              <th>Trạng thái</th>
              <th>Parse/Đổi</th>
              <th>ms</th>
              <th>Lỗi</th>
            </tr>
          </thead>
          <tbody>
            {(runs.data ?? []).map((r) => (
              <tr key={r.id}>
                <td>{ago(r.started_at)}</td>
                <td>{r.source_id}</td>
                <td>
                  <span className={`badge ${r.status === 'ok' ? 'ok' : r.status === 'failed' ? 'err' : ''}`}>
                    {r.status}
                  </span>
                </td>
                <td>
                  {r.rows_parsed}/{r.rows_changed}
                </td>
                <td>{r.duration_ms ?? '—'}</td>
                <td className="muted">{r.error ?? ''}</td>
              </tr>
            ))}
            {(runs.data ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  Chưa có lần crawl nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
