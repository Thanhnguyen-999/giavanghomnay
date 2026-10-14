import type { SourceConfig } from './config.ts';

type NumberConfig = SourceConfig['number'];

/// Chuyển chuỗi số của nguồn thành số đã nhân `multiplier`.
///
/// Bỏ mọi ký tự không phải chữ số và dấu phân cách đã cấu hình, nên các nhãn
/// như "120.500 đ", "₫1.235", "1 235,50" đều đọc được. Trả `null` nếu không có
/// chữ số nào.
export function parseNumber(raw: string, cfg: NumberConfig): number | null {
  if (!raw) return null;

  const { thousandSeparator, decimalSeparator, multiplier } = cfg;

  // Chỉ giữ chữ số, dấu âm, và hai dấu phân cách.
  const keep = new Set(['-', ...decimalSeparator, ...thousandSeparator]);
  let cleaned = '';
  for (const ch of raw) {
    if ((ch >= '0' && ch <= '9') || keep.has(ch)) cleaned += ch;
  }
  if (thousandSeparator) cleaned = cleaned.split(thousandSeparator).join('');
  if (decimalSeparator !== '.') cleaned = cleaned.split(decimalSeparator).join('.');

  // Dấu '-' chỉ hợp lệ ở đầu.
  const negative = cleaned.startsWith('-');
  cleaned = cleaned.replace(/-/g, '');
  if (cleaned === '' || cleaned === '.') return null;

  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return (negative ? -value : value) * multiplier;
}
