import { useMemo, useState } from 'react';
import { api } from '../api/client.ts';
import type { Brand, Product } from '../api/types.ts';
import { type Column, DataTable } from '../components/DataTable.tsx';
import { IconBox, IconPlus } from '../components/icons.tsx';
import { EmptyState, HoverTip, SearchInput, Segmented, StatusBadge } from '../components/ui.tsx';
import { useUi } from '../components/UiProvider.tsx';
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

const KIND_LABEL: Record<Product['kind'], string> = {
  bar: 'Vàng miếng',
  ring: 'Nhẫn',
  jewelry: 'Nữ trang',
};

export function ProductsPage({ canEdit }: { canEdit: boolean }) {
  const { toast, confirm } = useUi();
  const brands = useResource<Brand[]>('/admin/v1/brands');
  const products = useResource<Product[]>('/admin/v1/products');
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'hidden'>('all');

  const brandName = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of brands.data ?? []) m.set(b.id, b.name);
    return m;
  }, [brands.data]);

  const rows = useMemo(() => {
    let list = products.data ?? [];
    if (status === 'active') list = list.filter((p) => p.active);
    if (status === 'hidden') list = list.filter((p) => !p.active);
    return list;
  }, [products.data, status]);

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
      setShowForm(false);
      products.reload();
      toast(`Đã tạo sản phẩm "${form.name}".`, 'success');
    } catch (e) {
      setFormError(e instanceof Error ? e.message : String(e));
    }
  }

  async function toggleActive(p: Product) {
    if (p.active) {
      const ok = await confirm({
        title: 'Ẩn sản phẩm?',
        message: (
          <>
            Sản phẩm <strong>{p.name}</strong> sẽ bị ẩn khỏi API công khai. Lịch sử giá vẫn được giữ.
          </>
        ),
        confirmLabel: 'Ẩn sản phẩm',
        danger: true,
      });
      if (!ok) return;
      try {
        await api.del(`/admin/v1/products/${p.id}`);
        products.reload();
        toast(`Đã ẩn "${p.name}".`, 'success');
      } catch (e) {
        toast(e instanceof Error ? e.message : String(e), 'error');
      }
    } else {
      try {
        await api.patch(`/admin/v1/products/${p.id}`, { active: true });
        products.reload();
        toast(`Đã hiện lại "${p.name}".`, 'success');
      } catch (e) {
        toast(e instanceof Error ? e.message : String(e), 'error');
      }
    }
  }

  async function bulkHide(keys: string[]) {
    const ok = await confirm({
      title: `Ẩn ${keys.length} sản phẩm?`,
      message: 'Các sản phẩm đã chọn sẽ bị ẩn khỏi API công khai. Lịch sử giá vẫn được giữ.',
      confirmLabel: `Ẩn ${keys.length} sản phẩm`,
      danger: true,
    });
    if (!ok) return;
    try {
      await Promise.all(keys.map((id) => api.del(`/admin/v1/products/${id}`)));
      products.reload();
      toast(`Đã ẩn ${keys.length} sản phẩm.`, 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error');
    }
  }

  const columns: Column<Product>[] = [
    {
      key: 'name',
      header: 'Sản phẩm',
      searchText: (p) => `${p.name} ${p.id} ${p.slug}`,
      csv: (p) => p.name,
      render: (p) => (
        <HoverTip
          label={<strong>{p.name}</strong>}
          rows={[
            ['ID', p.id],
            ['Slug', p.slug],
            ['Tuổi vàng', p.purity ?? '—'],
            ['Thứ tự', p.sort_order],
          ]}
        />
      ),
    },
    {
      key: 'brand_id',
      header: 'Thương hiệu',
      csv: (p) => brandName.get(p.brand_id) ?? p.brand_id,
      render: (p) => brandName.get(p.brand_id) ?? p.brand_id,
    },
    {
      key: 'kind',
      header: 'Loại',
      csv: (p) => KIND_LABEL[p.kind],
      render: (p) => <span className="badge plain">{KIND_LABEL[p.kind]}</span>,
    },
    { key: 'region', header: 'Khu vực', csv: (p) => p.region ?? '', render: (p) => p.region ?? '—' },
    {
      key: 'max_spread_pct',
      header: 'Ngưỡng spread',
      numeric: true,
      csv: (p) => p.max_spread_pct,
      render: (p) => `${p.max_spread_pct}%`,
    },
    {
      key: 'max_change_pct',
      header: 'Ngưỡng biến động',
      numeric: true,
      csv: (p) => p.max_change_pct,
      render: (p) => `${p.max_change_pct}%`,
    },
    {
      key: 'active',
      header: 'Trạng thái',
      sortValue: (p) => p.active,
      csv: (p) => (p.active ? 'Đang hiện' : 'Đã ẩn'),
      render: (p) => <StatusBadge status={p.active ? 'active' : 'ignored'} />,
    },
    ...(canEdit
      ? [
          {
            key: '_act',
            header: '',
            sortable: false,
            render: (p: Product) => (
              <button className="btn sm ghost" onClick={() => toggleActive(p)}>
                {p.active ? 'Ẩn' : 'Hiện'}
              </button>
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Sản phẩm</h2>
          <div className="sub">
            {rows.length} sản phẩm · dùng để đối soát loại vàng từng thương hiệu
          </div>
        </div>
        {canEdit && (
          <div className="actions">
            <button className="btn primary" onClick={() => setShowForm((s) => !s)}>
              <IconPlus size={16} />
              Thêm sản phẩm
            </button>
          </div>
        )}
      </div>

      {products.error && <p className="error">{products.error}</p>}

      {showForm && canEdit && (
        <div className="card">
          <div className="card-head">
            <h3>Thêm sản phẩm</h3>
          </div>
          <div className="row">
            <div>
              <label>Thương hiệu</label>
              <select value={form.brandId} onChange={(e) => setForm({ ...form, brandId: e.target.value })}>
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
              <input value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} placeholder="sjc-mieng" />
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
              <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as Product['kind'] })}>
                <option value="bar">Vàng miếng</option>
                <option value="ring">Nhẫn</option>
                <option value="jewelry">Nữ trang</option>
              </select>
            </div>
            <div>
              <label>Tuổi vàng</label>
              <input value={form.purity} onChange={(e) => setForm({ ...form, purity: e.target.value })} placeholder="9999" />
            </div>
            <div>
              <label>Khu vực</label>
              <input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder="HCM" />
            </div>
          </div>
          {formError && <p className="error">{formError}</p>}
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <button className="btn primary" onClick={create} disabled={!form.id || !form.brandId || !form.name}>
              Tạo sản phẩm
            </button>
            <button className="btn ghost" onClick={() => setShowForm(false)}>
              Hủy
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder="Tìm theo tên, ID, slug…" />
          <Segmented
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all', label: 'Tất cả' },
              { value: 'active', label: 'Đang hiện' },
              { value: 'hidden', label: 'Đã ẩn' },
            ]}
          />
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(p) => p.id}
          search={search}
          selectable={canEdit}
          loading={products.loading && !products.data}
          exportName="san-pham"
          initialSort={{ key: 'brand_id', dir: 'asc' }}
          empty={
            <EmptyState
              icon={<IconBox size={28} />}
              title={search || status !== 'all' ? 'Không có sản phẩm khớp bộ lọc.' : 'Chưa có sản phẩm nào.'}
              hint={
                search || status !== 'all'
                  ? 'Thử xóa bớt từ khóa hoặc đổi bộ lọc trạng thái.'
                  : 'Thêm sản phẩm đầu tiên để bắt đầu đối soát giá.'
              }
              action={
                canEdit && !search && status === 'all' ? (
                  <button className="btn primary" onClick={() => setShowForm(true)}>
                    <IconPlus size={16} />
                    Thêm sản phẩm
                  </button>
                ) : undefined
              }
            />
          }
          bulkActions={
            canEdit ? (keys) => <button className="btn sm danger" onClick={() => bulkHide(keys)}>Ẩn đã chọn</button> : undefined
          }
        />
      </div>
    </>
  );
}
