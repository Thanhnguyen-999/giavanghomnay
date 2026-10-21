import { type ReactNode, useMemo, useState } from 'react';
import { Pagination } from './ui.tsx';

export interface Column<T> {
  key: string;
  header: ReactNode;
  /// Render ô. Nếu bỏ qua, hiển thị value[key].
  render?: (row: T) => ReactNode;
  /// Giá trị dùng để sort/tìm kiếm (mặc định lấy từ render-less key).
  sortValue?: (row: T) => string | number;
  /// Căn phải (cho số).
  numeric?: boolean;
  /// Cho phép sort cột này.
  sortable?: boolean;
  /// Chuỗi dùng cho tìm kiếm toàn cục.
  searchText?: (row: T) => string;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /// Bật chọn nhiều dòng (checkbox) + trả về các key đã chọn.
  selectable?: boolean;
  onSelectionChange?: (keys: string[]) => void;
  /// Thanh hành động hàng loạt hiển thị khi có dòng được chọn.
  bulkActions?: (selectedKeys: string[]) => ReactNode;
  /// Lọc toàn cục (chuỗi đã nhập ở toolbar ngoài).
  search?: string;
  empty?: ReactNode;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  defaultPageSize?: number;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  selectable = false,
  onSelectionChange,
  bulkActions,
  search = '',
  empty = 'Không có dữ liệu.',
  initialSort,
  defaultPageSize = 20,
}: Props<T>) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(
    initialSort ?? null,
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      columns.some((c) => {
        const txt = c.searchText?.(r) ?? String((r as Record<string, unknown>)[c.key] ?? '');
        return txt.toLowerCase().includes(q);
      }),
    );
  }, [rows, search, columns]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return filtered;
    const val = (r: T) =>
      col.sortValue?.(r) ?? ((r as Record<string, unknown>)[col.key] as string | number);
    return [...filtered].sort((a, b) => {
      const av = val(a);
      const bv = val(b);
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), 'vi');
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sort, columns]);

  const total = sorted.length;
  const safePage = Math.min(page, Math.max(1, Math.ceil(total / pageSize)));
  const pageRows = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const pageKeys = pageRows.map(rowKey);
  const allOnPageSelected = pageKeys.length > 0 && pageKeys.every((k) => selected.has(k));

  function toggleAll() {
    const next = new Set(selected);
    if (allOnPageSelected) pageKeys.forEach((k) => next.delete(k));
    else pageKeys.forEach((k) => next.add(k));
    setSelected(next);
    onSelectionChange?.([...next]);
  }
  function toggleRow(k: string) {
    const next = new Set(selected);
    next.has(k) ? next.delete(k) : next.add(k);
    setSelected(next);
    onSelectionChange?.([...next]);
  }
  function clickSort(c: Column<T>) {
    if (c.sortable === false) return;
    setSort((s) =>
      s?.key === c.key
        ? { key: c.key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { key: c.key, dir: 'asc' },
    );
  }

  return (
    <div>
      {selectable && selected.size > 0 && (
        <div className="toolbar" style={{ marginBottom: 8 }}>
          <span className="badge info plain">{selected.size} đã chọn</span>
          {bulkActions?.([...selected])}
          <button
            className="btn sm ghost"
            onClick={() => {
              setSelected(new Set());
              onSelectionChange?.([]);
            }}
          >
            Bỏ chọn
          </button>
        </div>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {selectable && (
                <th style={{ width: 36 }}>
                  <input
                    type="checkbox"
                    style={{ width: 16, height: 16 }}
                    checked={allOnPageSelected}
                    onChange={toggleAll}
                    aria-label="Chọn tất cả dòng trong trang"
                  />
                </th>
              )}
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`${c.numeric ? 'num' : ''} ${c.sortable !== false ? 'sortable' : ''}`}
                  onClick={() => clickSort(c)}
                  aria-sort={
                    sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'
                  }
                >
                  {c.header}
                  {c.sortable !== false && (
                    <span className="sort-ind">
                      {sort?.key === c.key ? (sort.dir === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td className="table-empty" colSpan={columns.length + (selectable ? 1 : 0)}>
                  {empty}
                </td>
              </tr>
            ) : (
              pageRows.map((row) => {
                const k = rowKey(row);
                return (
                  <tr key={k}>
                    {selectable && (
                      <td>
                        <input
                          type="checkbox"
                          style={{ width: 16, height: 16 }}
                          checked={selected.has(k)}
                          onChange={() => toggleRow(k)}
                          aria-label="Chọn dòng"
                        />
                      </td>
                    )}
                    {columns.map((c) => (
                      <td key={c.key} className={c.numeric ? 'num mono' : ''}>
                        {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? '')}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <Pagination
          page={safePage}
          pageSize={pageSize}
          total={total}
          onPage={setPage}
          onPageSize={(s) => {
            setPageSize(s);
            setPage(1);
          }}
        />
      </div>
    </div>
  );
}
