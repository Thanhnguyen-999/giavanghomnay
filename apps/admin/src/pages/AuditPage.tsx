import { useState } from 'react';
import { type Column, DataTable } from '../components/DataTable.tsx';
import { HoverTip, SearchInput, formatDateTime, timeAgo } from '../components/ui.tsx';
import { useResource } from '../lib/useResource.ts';

interface AuditRow {
  id: number;
  actor: string;
  action: string;
  entity: string;
  entity_id: string;
  at: number;
}

export function AuditPage() {
  const audit = useResource<AuditRow[]>('/admin/v1/audit?limit=200');
  const [search, setSearch] = useState('');

  const columns: Column<AuditRow>[] = [
    {
      key: 'at',
      header: 'Thời điểm',
      sortValue: (a) => a.at,
      render: (a) => <HoverTip label={timeAgo(a.at)} rows={[['Chính xác', formatDateTime(a.at)]]} />,
    },
    { key: 'actor', header: 'Người thực hiện', searchText: (a) => `${a.actor} ${a.action} ${a.entity} ${a.entity_id}` },
    { key: 'action', header: 'Hành động', render: (a) => <span className="badge plain">{a.action}</span> },
    {
      key: 'entity',
      header: 'Đối tượng',
      render: (a) => (
        <span className="mono">
          {a.entity}:{a.entity_id}
        </span>
      ),
    },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Audit log</h2>
          <div className="sub">Mọi thao tác thay đổi dữ liệu đều được ghi lại</div>
        </div>
      </div>

      {audit.error && <p className="error">{audit.error}</p>}

      <div className="card">
        <div className="toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder="Tìm người, hành động, đối tượng…" />
        </div>
        <DataTable
          columns={columns}
          rows={audit.data ?? []}
          rowKey={(a) => String(a.id)}
          search={search}
          initialSort={{ key: 'at', dir: 'desc' }}
          empty="Chưa có bản ghi."
        />
      </div>
    </>
  );
}
