import { useState } from 'react';
import { api } from '../api/client.ts';
import type { Brand } from '../api/types.ts';
import { type Column, DataTable } from '../components/DataTable.tsx';
import { IconPlus } from '../components/icons.tsx';
import { HoverTip, SearchInput, StatusBadge } from '../components/ui.tsx';
import { useUi } from '../components/UiProvider.tsx';
import { useResource } from '../lib/useResource.ts';

export function BrandsPage({ canEdit }: { canEdit: boolean }) {
  const { toast, confirm } = useUi();
  const { data, error, reload } = useResource<Brand[]>('/admin/v1/brands');
  const [form, setForm] = useState({ id: '', slug: '', name: '', sortOrder: 0 });
  const [formError, setFormError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');

  async function create() {
    setFormError(null);
    try {
      await api.post('/admin/v1/brands', { ...form, sortOrder: Number(form.sortOrder) });
      const name = form.name;
      setForm({ id: '', slug: '', name: '', sortOrder: 0 });
      setShowForm(false);
      reload();
      toast(`Đã tạo thương hiệu "${name}".`, 'success');
    } catch (e) {
      setFormError(e instanceof Error ? e.message : String(e));
    }
  }

  async function toggleActive(b: Brand) {
    if (b.active) {
      const ok = await confirm({
        title: 'Ẩn thương hiệu?',
        message: (
          <>
            Thương hiệu <strong>{b.name}</strong> sẽ bị ẩn. Sản phẩm thuộc thương hiệu này cũng
            không còn hiển thị công khai.
          </>
        ),
        confirmLabel: 'Ẩn thương hiệu',
        danger: true,
      });
      if (!ok) return;
    }
    try {
      if (b.active) await api.del(`/admin/v1/brands/${b.id}`);
      else await api.patch(`/admin/v1/brands/${b.id}`, { active: true });
      reload();
      toast(b.active ? `Đã ẩn "${b.name}".` : `Đã hiện lại "${b.name}".`, 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error');
    }
  }

  const columns: Column<Brand>[] = [
    {
      key: 'name',
      header: 'Thương hiệu',
      searchText: (b) => `${b.name} ${b.id} ${b.slug}`,
      render: (b) => (
        <HoverTip
          label={<strong>{b.name}</strong>}
          rows={[
            ['ID', b.id],
            ['Slug', b.slug],
            ['Thứ tự', b.sort_order],
          ]}
        />
      ),
    },
    { key: 'id', header: 'ID' },
    { key: 'slug', header: 'Slug' },
    { key: 'sort_order', header: 'Thứ tự', numeric: true },
    {
      key: 'active',
      header: 'Trạng thái',
      sortValue: (b) => b.active,
      render: (b) => <StatusBadge status={b.active ? 'active' : 'ignored'} />,
    },
    ...(canEdit
      ? [
          {
            key: '_act',
            header: '',
            sortable: false,
            render: (b: Brand) => (
              <button className="btn sm ghost" onClick={() => toggleActive(b)}>
                {b.active ? 'Ẩn' : 'Hiện'}
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
          <h2>Thương hiệu</h2>
          <div className="sub">{(data ?? []).length} thương hiệu vàng</div>
        </div>
        {canEdit && (
          <div className="actions">
            <button className="btn primary" onClick={() => setShowForm((s) => !s)}>
              <IconPlus size={16} />
              Thêm thương hiệu
            </button>
          </div>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      {showForm && canEdit && (
        <div className="card">
          <div className="card-head">
            <h3>Thêm thương hiệu</h3>
          </div>
          <div className="row">
            <div>
              <label>ID (chữ thường, gạch ngang)</label>
              <input value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} placeholder="sjc" />
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
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <button className="btn primary" onClick={create} disabled={!form.id || !form.name}>
              Tạo
            </button>
            <button className="btn ghost" onClick={() => setShowForm(false)}>
              Hủy
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder="Tìm thương hiệu…" />
        </div>
        <DataTable
          columns={columns}
          rows={data ?? []}
          rowKey={(b) => b.id}
          search={search}
          initialSort={{ key: 'sort_order', dir: 'asc' }}
          empty="Chưa có thương hiệu nào."
        />
      </div>
    </>
  );
}
