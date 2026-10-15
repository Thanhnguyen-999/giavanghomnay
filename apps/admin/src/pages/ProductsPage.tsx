import { useState } from 'react';
import { api } from '../api/client.ts';
import type { Brand, Product } from '../api/types.ts';
import { useResource } from '../lib/useResource.ts';

const emptyForm = {
  id: '',
  brandId: '',
  slug: '',
  name: '',
  kind: 'bar' as Product['kind'],
  purity: '',
  region: '',
};

export function ProductsPage({ canEdit }: { canEdit: boolean }) {
  const brands = useResource<Brand[]>('/admin/v1/brands');
  const products = useResource<Product[]>('/admin/v1/products');
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  async function create() {
    setFormError(null);
    try {
      await api.post('/admin/v1/products', {
        id: form.id,
        brandId: form.brandId,
        slug: form.slug,
        name: form.name,
        kind: form.kind,
        purity: form.purity || undefined,
        region: form.region || undefined,
      });
      setForm(emptyForm);
      products.reload();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : String(e));
    }
  }

  async function toggleActive(p: Product) {
    if (p.active) await api.del(`/admin/v1/products/${p.id}`);
    else await api.patch(`/admin/v1/products/${p.id}`, { active: true });
    products.reload();
  }

  return (
    <>
      <h2>Sản phẩm</h2>
      {products.error && <p className="error">{products.error}</p>}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Thương hiệu</th>
              <th>Tên</th>
              <th>Loại</th>
              <th>Khu vực</th>
              <th>Ngưỡng (spread/change %)</th>
              <th>Trạng thái</th>
              {canEdit && <th />}
            </tr>
          </thead>
          <tbody>
            {(products.data ?? []).map((p) => (
              <tr key={p.id}>
                <td>{p.id}</td>
                <td>{p.brand_id}</td>
                <td>{p.name}</td>
                <td>{p.kind}</td>
                <td>{p.region ?? '—'}</td>
                <td>
                  {p.max_spread_pct} / {p.max_change_pct}
                </td>
                <td>
                  <span className={`badge ${p.active ? 'ok' : 'err'}`}>
                    {p.active ? 'Hiện' : 'Ẩn'}
                  </span>
                </td>
                {canEdit && (
                  <td>
                    <button onClick={() => toggleActive(p)}>{p.active ? 'Ẩn' : 'Hiện'}</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canEdit && (
        <div className="card">
          <h3>Thêm sản phẩm</h3>
          <div className="row">
            <div>
              <label>Thương hiệu</label>
              <select
                value={form.brandId}
                onChange={(e) => setForm({ ...form, brandId: e.target.value })}
              >
                <option value="">— chọn —</option>
                {(brands.data ?? []).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>ID</label>
              <input value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} />
            </div>
            <div>
              <label>Slug</label>
              <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
            </div>
          </div>
          <div className="row">
            <div>
              <label>Tên</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label>Loại</label>
              <select
                value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value as Product['kind'] })}
              >
                <option value="bar">Vàng miếng</option>
                <option value="ring">Nhẫn</option>
                <option value="jewelry">Nữ trang</option>
              </select>
            </div>
            <div>
              <label>Tuổi vàng</label>
              <input
                value={form.purity}
                onChange={(e) => setForm({ ...form, purity: e.target.value })}
                placeholder="9999"
              />
            </div>
            <div>
              <label>Khu vực</label>
              <input
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
                placeholder="HCM"
              />
            </div>
          </div>
          {formError && <p className="error">{formError}</p>}
          <p>
            <button
              className="primary"
              onClick={create}
              disabled={!form.id || !form.brandId || !form.name}
            >
              Tạo
            </button>
          </p>
        </div>
      )}
    </>
  );
}
