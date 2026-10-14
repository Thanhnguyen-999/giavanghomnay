/// Unix giây hiện tại (UTC).
export function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

/// Ngày giao dịch theo giờ Việt Nam (UTC+7), dạng 'YYYY-MM-DD'.
///
/// Dùng cho `price_daily`: giá lúc 00:30 giờ VN phải thuộc ngày VN, không phải
/// ngày UTC (lúc đó vẫn là 17:30 hôm trước).
export function vnDay(unixSec: number): string {
  // +7 giờ rồi lấy phần ngày theo UTC.
  const shifted = new Date((unixSec + 7 * 3600) * 1000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/// Số giây lùi về quá khứ cho một khoảng range của biểu đồ.
const RANGE_SECONDS: Record<string, number> = {
  '1d': 86_400,
  '1w': 604_800,
  '1m': 2_592_000,
  '3m': 7_776_000,
  '6m': 15_552_000,
  '1y': 31_536_000,
};

export type HistoryRange = keyof typeof RANGE_SECONDS;

export function isHistoryRange(v: string): v is HistoryRange {
  return v in RANGE_SECONDS;
}

export function rangeSeconds(range: HistoryRange): number {
  return RANGE_SECONDS[range] ?? RANGE_SECONDS['1m']!;
}

/// Range nào dùng dữ liệu tick (chi tiết) thay vì tổng hợp ngày.
export function usesTicks(range: HistoryRange): boolean {
  return range === '1d' || range === '1w';
}
