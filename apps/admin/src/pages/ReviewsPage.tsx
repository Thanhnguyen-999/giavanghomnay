import { useState } from 'react';
import { api } from '../api/client.ts';
import type { Review } from '../api/types.ts';
import { type Column, DataTable } from '../components/DataTable.tsx';
import { Delta, HoverTip, SearchInput, formatVnd, timeAgo } from '../components/ui.tsx';
import { useUi } from '../components/UiProvider.tsx';
import { useResource } from '../lib/useResource.ts';

const REASON_LABEL: Record<string, string> = {
  spread_exceeded: 'Chênh mua/bán vượt ngưỡng',
  change_exceeded: 'Biến động vượt ngưỡng',
  invalid: 'Dữ liệu không hợp lệ',
};

export function ReviewsPage({ canEdit }: { canEdit: boolean }) {
  const { toast, confirm } = useUi();
  const reviews = useResource<Review[]>('/admin/v1/reviews?status=pending');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<number | null>(null);

  async function act(id: number, action: 'approve' | 'reject') {
    setBusy(id);
    try {
      await api.post(`/admin/v1/reviews/${id}/${action}`);
      reviews.reload();
      toast(action === 'approve' ? 'Đã duyệt và công bố giá.' : 'Đã từ chối giá này.', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setBusy(null);
    }
  }

  async function bulk(keys: string[], action: 'approve' | 'reject') {
    const ok = await confirm({
      title: action === 'approve' ? `Duyệt ${keys.length} giá?` : `Từ chối ${keys.length} giá?`,
      message:
        action === 'approve'
          ? 'Các giá đã chọn sẽ được công bố ra API công khai.'
          : 'Các giá đã chọn sẽ bị bỏ, không công bố.',
      confirmLabel: action === 'approve' ? 'Duyệt tất cả' : 'Từ chối tất cả',
      danger: action === 'reject',
    });
    if (!ok) return;
    try {
      await Promise.all(keys.map((id) => api.post(`/admin/v1/reviews/${id}/${action}`)));
      reviews.reload();
      toast(
        action === 'approve'
          ? `Đã duyệt ${keys.length} giá.`
          : `Đã từ chối ${keys.length} giá.`,
        'success',
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error');
    }
  }

  const columns: Column<Review>[] = [
    {
      key: 'product_name',
      header: 'Sản phẩm',
      searchText: (r) => `${r.product_name} ${r.product_id} ${r.source_id}`,
      render: (r) => (
        <HoverTip
          label={<strong>{r.product_name}</strong>}
          rows={[
            ['Mã SP', r.product_id],
            ['Nguồn', r.source_id],
            ['Ghi nhận', timeAgo(r.created_at)],
          ]}
        />
      ),
    },
    {
      key: 'buy',
      header: 'Giá mua (mới)',
      numeric: true,
      render: (r) => (
        <HoverTip
          label={<span>{formatVnd(r.buy)}</span>}
          rows={[
            ['Giá cũ', r.prev_buy ? `${formatVnd(r.prev_buy)} đ` : '—'],
            ['Thay đổi', <Delta key="d" value={r.prev_buy ? r.buy - r.prev_buy : null} />],
          ]}
        />
      ),
    },
    {
      key: 'sell',
      header: 'Giá bán (mới)',
      numeric: true,
      render: (r) => (
        <HoverTip
          label={<span>{formatVnd(r.sell)}</span>}
          rows={[
            ['Giá cũ', r.prev_sell ? `${formatVnd(r.prev_sell)} đ` : '—'],
            ['Thay đổi', <Delta key="d" value={r.prev_sell ? r.sell - r.prev_sell : null} />],
          ]}
        />
      ),
    },
    {
      key: 'delta_sell',
      header: 'Chênh bán',
      numeric: true,
      sortValue: (r) => (r.prev_sell ? r.sell - r.prev_sell : 0),
      render: (r) => <Delta value={r.prev_sell ? r.sell - r.prev_sell : null} />,
    },
    {
      key: 'reason',
      header: 'Lý do cách ly',
      render: (r) => (
        <HoverTip label={<span className="badge warn">{REASON_LABEL[r.reason] ?? r.reason}</span>} rows={[['Mã lý do', r.reason]]} />
      ),
    },
    ...(canEdit
      ? [
          {
            key: '_act',
            header: '',
            sortable: false,
            render: (r: Review) => (
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn sm primary" disabled={busy === r.id} onClick={() => act(r.id, 'approve')}>
                  Duyệt
                </button>
                <button className="btn sm danger" disabled={busy === r.id} onClick={() => act(r.id, 'reject')}>
                  Từ chối
                </button>
              </div>
            ),
          },
        ]
      : []),
  ];

  const count = reviews.data?.length ?? 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Kiểm duyệt giá</h2>
          <div className="sub">
            Giá bất thường được cách ly, không publish cho tới khi duyệt. Hover để so sánh giá cũ/mới.
          </div>
        </div>
        <div className="actions">
          <span className={`badge ${count > 0 ? 'warn' : 'ok'}`}>{count} chờ duyệt</span>
        </div>
      </div>

      {reviews.error && <p className="error">{reviews.error}</p>}

      <div className="card">
        <div className="toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder="Tìm sản phẩm, nguồn…" />
        </div>
        <DataTable
          columns={columns}
          rows={reviews.data ?? []}
          rowKey={(r) => String(r.id)}
          search={search}
          selectable={canEdit}
          initialSort={{ key: 'delta_sell', dir: 'desc' }}
          empty="Không có giá nào chờ duyệt. Hệ thống đang hoạt động bình thường."
          bulkActions={
            canEdit
              ? (keys) => (
                  <>
                    <button className="btn sm primary" onClick={() => bulk(keys, 'approve')}>
                      Duyệt đã chọn
                    </button>
                    <button className="btn sm danger" onClick={() => bulk(keys, 'reject')}>
                      Từ chối đã chọn
                    </button>
                  </>
                )
              : undefined
          }
        />
      </div>
    </>
  );
}
