import { api } from '../api/client.ts';
import type { Review } from '../api/types.ts';
import { useResource } from '../lib/useResource.ts';

const fmt = new Intl.NumberFormat('vi-VN');

export function ReviewsPage({ canEdit }: { canEdit: boolean }) {
  const reviews = useResource<Review[]>('/admin/v1/reviews?status=pending');

  async function act(id: number, action: 'approve' | 'reject') {
    await api.post(`/admin/v1/reviews/${id}/${action}`);
    reviews.reload();
  }

  return (
    <>
      <h2>Kiểm duyệt giá bất thường</h2>
      {reviews.error && <p className="error">{reviews.error}</p>}
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Sản phẩm</th>
              <th>Nguồn</th>
              <th>Mua → (trước)</th>
              <th>Bán → (trước)</th>
              <th>Lý do</th>
              {canEdit && <th />}
            </tr>
          </thead>
          <tbody>
            {(reviews.data ?? []).map((r) => (
              <tr key={r.id}>
                <td>{r.product_name}</td>
                <td>{r.source_id}</td>
                <td>
                  {fmt.format(r.buy)}{' '}
                  <span className="muted">({r.prev_buy ? fmt.format(r.prev_buy) : '—'})</span>
                </td>
                <td>
                  {fmt.format(r.sell)}{' '}
                  <span className="muted">({r.prev_sell ? fmt.format(r.prev_sell) : '—'})</span>
                </td>
                <td>
                  <span className="badge err">{r.reason}</span>
                </td>
                {canEdit && (
                  <td className="row">
                    <button className="primary" onClick={() => act(r.id, 'approve')}>
                      Duyệt
                    </button>
                    <button onClick={() => act(r.id, 'reject')}>Từ chối</button>
                  </td>
                )}
              </tr>
            ))}
            {(reviews.data ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  Không có giá nào chờ duyệt.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
