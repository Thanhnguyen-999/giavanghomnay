import type { ReactNode } from 'react';
import {
  IconChevronLeft,
  IconChevronRight,
  IconDown,
  IconDownload,
  IconSearch,
  IconUp,
  IconX,
} from './icons.tsx';

const vnd = new Intl.NumberFormat('vi-VN');

export function formatVnd(n: number | null | undefined): string {
  if (n == null) return '—';
  return vnd.format(Math.round(n));
}

export function formatDateTime(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function timeAgo(unixSec: number): string {
  const diff = Math.floor(Date.now() / 1000) - unixSec;
  if (diff < 0) return 'vừa xong';
  if (diff < 60) return `${diff}s trước`;
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  return `${Math.floor(diff / 86400)} ngày trước`;
}

/// Chênh lệch giá có màu + mũi tên + dấu (không chỉ dựa màu).
export function Delta({ value }: { value: number | null | undefined }) {
  if (value == null || value === 0) {
    return <span className="delta flat">—</span>;
  }
  const up = value > 0;
  return (
    <span className={`delta ${up ? 'up' : 'down'}`}>
      {up ? <IconUp size={13} /> : <IconDown size={13} />}
      {up ? '+' : '−'}
      {formatVnd(Math.abs(value))}
    </span>
  );
}

/// Badge trạng thái với màu ngữ nghĩa.
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    ok: { cls: 'ok', label: 'OK' },
    active: { cls: 'ok', label: 'Hoạt động' },
    mapped: { cls: 'ok', label: 'Đã gán' },
    approved: { cls: 'ok', label: 'Đã duyệt' },
    pending: { cls: 'warn', label: 'Chờ' },
    partial: { cls: 'warn', label: 'Một phần' },
    quarantined: { cls: 'warn', label: 'Cách ly' },
    failed: { cls: 'err', label: 'Lỗi' },
    rejected: { cls: 'err', label: 'Từ chối' },
    ignored: { cls: 'plain', label: 'Bỏ qua' },
  };
  const m = map[status] ?? { cls: 'plain', label: status };
  return <span className={`badge ${m.cls}`}>{m.label}</span>;
}

/// Tooltip hover hiển thị bảng chi tiết (dùng cho đối soát).
export function HoverTip({ label, rows }: { label: ReactNode; rows: [string, ReactNode][] }) {
  return (
    <span className="has-tip">
      {label}
      <span className="tip" role="tooltip">
        <dl>
          {rows.map(([k, v], i) => (
            <span key={i} style={{ display: 'contents' }}>
              <span className="tip-k">{k}</span>
              <span className="tip-v">{v}</span>
            </span>
          ))}
        </dl>
      </span>
    </span>
  );
}

/// Bộ chọn phân đoạn (segmented control) cho bộ lọc nhanh / khung thời gian.
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          className={o.value === value ? 'active' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/// Ô tìm kiếm có icon.
export function SearchInput({
  value,
  onChange,
  placeholder = 'Tìm kiếm…',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="topbar-search grow">
      <IconSearch size={16} />
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-label={placeholder}
      />
    </div>
  );
}

/// Chip bộ lọc đang áp dụng, có nút gỡ.
export function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="chip">
      {label}
      <button onClick={onRemove} aria-label={`Bỏ lọc ${label}`}>
        <IconX size={13} />
      </button>
    </span>
  );
}

/// Thanh phân trang.
export function Pagination({
  page,
  pageSize,
  total,
  onPage,
  onPageSize,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
  onPageSize: (s: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="pagination">
      <span>
        {from}–{to} trong <strong className="mono">{total}</strong>
      </span>
      <span className="spacer" />
      <label style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
        Mỗi trang
        <select
          className="page-size"
          value={pageSize}
          onChange={(e) => onPageSize(Number(e.target.value))}
          aria-label="Số dòng mỗi trang"
        >
          {[10, 20, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <button
        className="btn sm icon"
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
        aria-label="Trang trước"
      >
        <IconChevronLeft size={16} />
      </button>
      <span className="mono">
        {page}/{pages}
      </span>
      <button
        className="btn sm icon"
        onClick={() => onPage(page + 1)}
        disabled={page >= pages}
        aria-label="Trang sau"
      >
        <IconChevronRight size={16} />
      </button>
    </div>
  );
}

export function Spinner() {
  return (
    <div className="center-pad">
      <div className="spinner" role="status" aria-label="Đang tải" />
    </div>
  );
}

/// Khung xương (skeleton) cho bảng trong lúc tải dữ liệu.
export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="skeleton-table" aria-hidden="true">
      <div className="sk-row sk-head">
        {Array.from({ length: cols }).map((_, i) => (
          <span key={i} className="sk-cell" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="sk-row">
          {Array.from({ length: cols }).map((_, c) => (
            <span key={c} className="sk-cell" style={{ width: `${55 + ((r * 7 + c * 13) % 40)}%` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

/// Trạng thái rỗng kèm icon + mô tả + nút hành động tùy chọn.
export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: ReactNode;
  title: string;
  hint?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-ico">{icon}</div>}
      <div className="empty-title">{title}</div>
      {hint && <div className="empty-hint">{hint}</div>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}

/// Chuyển mảng đối tượng thành CSV (RFC 4180) và kích hoạt tải xuống.
export function downloadCsv(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))];
  // BOM để Excel đọc đúng UTF-8 (tiếng Việt).
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/// Nút xuất CSV dùng chung.
export function ExportButton({ onExport, disabled }: { onExport: () => void; disabled?: boolean }) {
  return (
    <button className="btn sm ghost" onClick={onExport} disabled={disabled} title="Xuất CSV">
      <IconDownload size={15} />
      Xuất CSV
    </button>
  );
}
