import { useState } from 'react';
import { api } from '../api/client.ts';
import type { AdminRole } from '../api/types.ts';
import { useResource } from '../lib/useResource.ts';

interface AdminRow {
  email: string;
  role: AdminRole;
  active: number;
  created_at: number;
}

export function AdminsPage() {
  const admins = useResource<AdminRow[]>('/admin/v1/admins');
  const [form, setForm] = useState({ email: '', role: 'viewer' as AdminRole });
  const [err, setErr] = useState<string | null>(null);

  async function upsert() {
    setErr(null);
    try {
      await api.post('/admin/v1/admins', form);
      setForm({ email: '', role: 'viewer' });
      admins.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  async function deactivate(email: string) {
    setErr(null);
    try {
      await api.del(`/admin/v1/admins/${encodeURIComponent(email)}`);
      admins.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <>
      <h2>Quản trị viên</h2>
      {admins.error && <p className="error">{admins.error}</p>}
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Vai trò</th>
              <th>Trạng thái</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(admins.data ?? []).map((a) => (
              <tr key={a.email}>
                <td>{a.email}</td>
                <td>{a.role}</td>
                <td>
                  <span className={`badge ${a.active ? 'ok' : 'err'}`}>
                    {a.active ? 'Hoạt động' : 'Vô hiệu'}
                  </span>
                </td>
                <td>
                  {a.active === 1 && <button onClick={() => deactivate(a.email)}>Vô hiệu hóa</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Thêm / đổi vai trò</h3>
        <div className="row">
          <div>
            <label>Email (khớp email đăng nhập Access)</label>
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label>Vai trò</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as AdminRole })}
            >
              <option value="viewer">viewer (chỉ xem)</option>
              <option value="editor">editor (sửa dữ liệu)</option>
              <option value="owner">owner (toàn quyền)</option>
            </select>
          </div>
        </div>
        {err && <p className="error">{err}</p>}
        <p>
          <button className="primary" onClick={upsert} disabled={!form.email}>
            Lưu
          </button>
        </p>
      </div>
    </>
  );
}
