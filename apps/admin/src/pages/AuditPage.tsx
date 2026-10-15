import { useResource } from '../lib/useResource.ts';

interface AuditRow {
  id: number;
  actor: string;
  action: string;
  entity: string;
  entity_id: string;
  at: number;
}

export function AuditPage() {
  const audit = useResource<AuditRow[]>('/admin/v1/audit?limit=200');

  return (
    <>
      <h2>Audit log</h2>
      {audit.error && <p className="error">{audit.error}</p>}
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Thời điểm</th>
              <th>Người thực hiện</th>
              <th>Hành động</th>
              <th>Đối tượng</th>
            </tr>
          </thead>
          <tbody>
            {(audit.data ?? []).map((a) => (
              <tr key={a.id}>
                <td>{new Date(a.at * 1000).toLocaleString('vi-VN')}</td>
                <td>{a.actor}</td>
                <td>{a.action}</td>
                <td>
                  {a.entity}:{a.entity_id}
                </td>
              </tr>
            ))}
            {(audit.data ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  Chưa có bản ghi.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
