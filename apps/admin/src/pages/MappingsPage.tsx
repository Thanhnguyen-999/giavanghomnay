import { useState } from 'react';
import { api } from '../api/client.ts';
import type { Mapping, Product, Source } from '../api/types.ts';
import { formatVnd } from '../components/ui.tsx';
import { useUi } from '../components/UiProvider.tsx';
import { useResource } from '../lib/useResource.ts';

export function MappingsPage({ canEdit }: { canEdit: boolean }) {
  const { toast } = useUi();
  const sources = useResource<Source[]>('/admin/v1/sources');
  const [sourceId, setSourceId] = useState<string>('');
  const products = useResource<Product[]>('/admin/v1/products');
  const mappings = useResource<Mapping[]>(sourceId ? `/admin/v1/mappings/${sourceId}?status=pending` : null);

  async function mapTo(raw: string, productId: string) {
    try {
      await api.patch(`/admin/v1/mappings/${sourceId}/${encodeURIComponent(raw)}`, {
        productId,
        status: 'mapped',
      });
      mappings.reload();
      toast(`Đã gán nhãn "${raw}".`, 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error');
    }
  }
  async function ignore(raw: string) {
    try {
      await api.patch(`/admin/v1/mappings/${sourceId}/${encodeURIComponent(raw)}`, {
        productId: null,
        status: 'ignored',
      });
      mappings.reload();
      toast(`Đã bỏ qua nhãn "${raw}".`, 'info');
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error');
    }
  }

  const pending = mappings.data?.length ?? 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Gán nhãn → sản phẩm</h2>
          <div className="sub">Mỗi nhãn thô từ nguồn được gán vào một sản phẩm để công bố giá</div>
        </div>
      </div>

      <div className="card">
        <label>Nguồn (chỉ nguồn trong nước có nhãn)</label>
        <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} style={{ maxWidth: 360 }}>
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
          <div className="card-head">
            <h3>Nhãn đang chờ</h3>
            <div className="actions">
              <span className={`badge ${pending > 0 ? 'warn' : 'ok'}`}>{pending} nhãn</span>
            </div>
          </div>
          {mappings.error && <p className="error">{mappings.error}</p>}
          <div className="table-wrap" style={{ border: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>Nhãn thô (rawKey)</th>
                  <th className="num">Giá mẫu mua</th>
                  <th className="num">Giá mẫu bán</th>
                  {canEdit && <th>Gán vào sản phẩm</th>}
                </tr>
              </thead>
              <tbody>
                {(mappings.data ?? []).map((m) => (
                  <tr key={m.raw_key}>
                    <td className="mono">{m.raw_key}</td>
                    <td className="num mono">{formatVnd(m.sample_buy)}</td>
                    <td className="num mono">{formatVnd(m.sample_sell)}</td>
                    {canEdit && (
                      <td>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <select
                            defaultValue=""
                            onChange={(e) => e.target.value && mapTo(m.raw_key, e.target.value)}
                            style={{ maxWidth: 240 }}
                          >
                            <option value="">— chọn sản phẩm —</option>
                            {(products.data ?? [])
                              .filter((p) => p.active)
                              .map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                          </select>
                          <button className="btn sm ghost" onClick={() => ignore(m.raw_key)}>
                            Bỏ qua
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {pending === 0 && (
                  <tr>
                    <td colSpan={4} className="table-empty">
                      Không có nhãn chờ. Chạy nguồn để nhãn mới xuất hiện.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
