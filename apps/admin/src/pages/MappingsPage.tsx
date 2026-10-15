import { useState } from 'react';
import { api } from '../api/client.ts';
import type { Mapping, Product, Source } from '../api/types.ts';
import { useResource } from '../lib/useResource.ts';

export function MappingsPage({ canEdit }: { canEdit: boolean }) {
  const sources = useResource<Source[]>('/admin/v1/sources');
  const [sourceId, setSourceId] = useState<string>('');
  const products = useResource<Product[]>('/admin/v1/products');
  const mappings = useResource<Mapping[]>(sourceId ? `/admin/v1/mappings/${sourceId}?status=pending` : null);

  async function mapTo(raw: string, productId: string) {
    await api.patch(`/admin/v1/mappings/${sourceId}/${encodeURIComponent(raw)}`, {
      productId,
      status: 'mapped',
    });
    mappings.reload();
  }
  async function ignore(raw: string) {
    await api.patch(`/admin/v1/mappings/${sourceId}/${encodeURIComponent(raw)}`, {
      productId: null,
      status: 'ignored',
    });
    mappings.reload();
  }

  return (
    <>
      <h2>Gán nhãn → sản phẩm</h2>
      <div className="card">
        <label>Nguồn (chỉ nguồn trong nước có nhãn)</label>
        <select value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
          <option value="">— chọn nguồn —</option>
          {(sources.data ?? [])
            .filter((s) => s.kind === 'domestic')
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
        </select>
      </div>

      {sourceId && (
        <div className="card">
          <h3>Nhãn đang chờ ({mappings.data?.length ?? 0})</h3>
          {mappings.error && <p className="error">{mappings.error}</p>}
          <table>
            <thead>
              <tr>
                <th>rawKey</th>
                <th>Giá mẫu (mua/bán)</th>
                {canEdit && <th>Gán vào sản phẩm</th>}
              </tr>
            </thead>
            <tbody>
              {(mappings.data ?? []).map((m) => (
                <tr key={m.raw_key}>
                  <td>{m.raw_key}</td>
                  <td>
                    {m.sample_buy ?? '—'} / {m.sample_sell ?? '—'}
                  </td>
                  {canEdit && (
                    <td className="row">
                      <select
                        defaultValue=""
                        onChange={(e) => e.target.value && mapTo(m.raw_key, e.target.value)}
                      >
                        <option value="">— chọn —</option>
                        {(products.data ?? [])
                          .filter((p) => p.active)
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                      </select>
                      <button onClick={() => ignore(m.raw_key)}>Bỏ qua</button>
                    </td>
                  )}
                </tr>
              ))}
              {(mappings.data ?? []).length === 0 && (
                <tr>
                  <td colSpan={3} className="muted">
                    Không có nhãn chờ. Chạy nguồn để nhãn mới xuất hiện.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
