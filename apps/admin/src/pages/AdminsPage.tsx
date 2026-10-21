import { useState } from 'react';
import { api } from '../api/client.ts';
import type { AdminRole } from '../api/types.ts';
import { type Column, DataTable } from '../components/DataTable.tsx';
import { IconPlus } from '../components/icons.tsx';
import { SearchInput, StatusBadge, formatDateTime } from '../components/ui.tsx';
import { useUi } from '../components/UiProvider.tsx';
import { useResource } from '../lib/useResource.ts';

interface AdminRow {
  email: string;
  role: AdminRole;
  active: number;
  created_at: number;
}

const ROLE_LABEL: Record<AdminRole, string> = {
  viewer: 'Chỉ xem',
  editor: 'Biên tập',
  owner: 'Toàn quyền',
};

export function AdminsPage() {
  const { toast, confirm } = useUi();
  const admins = useResource<AdminRow[]>('/admin/v1/admins');
  const [form, setForm] = useState({ email: '', role: 'viewer' as AdminRole });
  const [err, setErr] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');

  async function upsert() {
    setErr(null);
    try {
      await api.post('/admin/v1/admins', form);
      const email = form.email;
      setForm({ email: '', role: 'viewer' });
      setShowForm(false);
      admins.reload();
      toast(`Đã cập nhật quyền cho ${email}.`, 'success');
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  async function deactivate(email: string) {
    setErr(null);
    const ok = await confirm({
      title: 'Vô hiệu hóa quản trị viên?',
      message: (
        <>
          <strong>{email}</strong> sẽ mất quyền truy cập trang quản trị. Bạn có thể cấp lại quyền
          sau.
        </>
      ),
      confirmLabel: 'Vô hiệu hóa',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.del(`/admin/v1/admins/${encodeURIComponent(email)}`);
      admins.reload();
      toast(`Đã vô hiệu hóa ${email}.`, 'success');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg);
      toast(msg, 'error');
    }
  }

  const columns: Column<AdminRow>[] = [
    { key: 'email', header: 'Email', searchText: (a) => `${a.email} ${a.role}` },
    {
      key: 'role',
      header: 'Vai trò',
      render: (a) => <span className="badge info plain">{ROLE_LABEL[a.role]}</span>,
    },
    {
      key: 'active',
      header: 'Trạng thái',
      sortValue: (a) => a.active,
      render: (a) => <StatusBadge status={a.active ? 'active' : 'rejected'} />,
    },
    { key: 'created_at', header: 'Tạo lúc', render: (a) => formatDateTime(a.created_at) },
    {
      key: '_act',
      header: '',
      sortable: false,
      render: (a) =>
        a.active === 1 ? (
          <button className="btn sm danger" onClick={() => deactivate(a.email)}>
            Vô hiệu hóa
          </button>
        ) : null,
    },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Quản trị viên</h2>
          <div className="sub">Phân quyền: chỉ xem · biên tập · toàn quyền</div>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={() => setShowForm((s) => !s)}>
            <IconPlus size={16} />
            Thêm / đổi vai trò
          </button>
        </div>
      </div>

      {admins.error && <p className="error">{admins.error}</p>}

      {showForm && (
        <div className="card">
          <div className="card-head">
            <h3>Thêm hoặc đổi vai trò</h3>
          </div>
          <div className="row">
            <div>
              <label>Email (khớp email đăng nhập)</label>
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label>Vai trò</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as AdminRole })}>
                <option value="viewer">viewer (chỉ xem)</option>
                <option value="editor">editor (sửa dữ liệu)</option>
                <option value="owner">owner (toàn quyền)</option>
              </select>
            </div>
          </div>
          {err && <p className="error">{err}</p>}
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <button className="btn primary" onClick={upsert} disabled={!form.email}>
              Lưu
            </button>
            <button className="btn ghost" onClick={() => setShowForm(false)}>
              Hủy
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder="Tìm email…" />
        </div>
        <DataTable
          columns={columns}
          rows={admins.data ?? []}
          rowKey={(a) => a.email}
          search={search}
          initialSort={{ key: 'email', dir: 'asc' }}
          empty="Chưa có quản trị viên."
        />
      </div>
    </>
  );
}
