import { useState } from 'react';
import { api } from '../api/client.ts';
import type { Brand } from '../api/types.ts';
import { useResource } from '../lib/useResource.ts';

export function BrandsPage({ canEdit }: { canEdit: boolean }) {
  const { data, error, loading, reload } = useResource<Brand[]>('/admin/v1/brands');
  const [form, setForm] = useState({ id: '', slug: '', name: '', sortOrder: 0 });
  const [formError, setFormError] = useState<string | null>(null);

  async function create() {
    setFormError(null);
    try {
      await api.post('/admin/v1/brands', { ...form, sortOrder: Number(form.sortOrder) });
      setForm({ id: '', slug: '', name: '', sortOrder: 0 });
      reload();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : String(e));
    }
  }

  async function toggleActive(b: Brand) {
    if (b.active) await api.del(`/admin/v1/brands/${b.id}`);
    else await api.patch(`/admin/v1/brands/${b.id}`, { active: true });
    reload();
  }

  return (
    <>
      <h2>Thương hiệu</h2>
      {error && <p className="error">{error}</p>}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Tên</th>
              <th>Slug</th>
              <th>Thứ tự</th>
              <th>Trạng thái</th>
              {canEdit && <th />}
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((b) => (
              <tr key={b.id}>
                <td>{b.id}</td>
                <td>{b.name}</td>
                <td>{b.slug}</td>
                <td>{b.sort_order}</td>
                <td>
                  <span className={`badge ${b.active ? 'ok' : 'err'}`}>
                    {b.active ? 'Hiện' : 'Ẩn'}
                  </span>
                </td>
                {canEdit && (
                  <td>
                    <button onClick={() => toggleActive(b)}>{b.active ? 'Ẩn' : 'Hiện'}</button>
                  </td>
                )}
              </tr>
            ))}
            {!loading && (data ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  Chưa có thương hiệu nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {canEdit && (
        <div className="card">
          <h3>Thêm thương hiệu</h3>
          <div className="row">
            <div>
              <label>ID (chữ thường, gạch ngang)</label>
              <input value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} />
            </div>
            <div>
              <label>Slug</label>
              <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
            </div>
            <div>
              <label>Tên hiển thị</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label>Thứ tự</label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
              />
            </div>
          </div>
          {formError && <p className="error">{formError}</p>}
          <p>
            <button className="primary" onClick={create} disabled={!form.id || !form.name}>
              Tạo
            </button>
          </p>
        </div>
      )}
    </>
  );
}
