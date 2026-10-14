/// Một dòng giá đã trích + chuẩn hóa (số đã về đồng/lượng).
export interface ExtractedRow {
  /// Khóa ổn định để map sang product (đã chuẩn hóa).
  rawKey: string;
  label: string;
  region?: string;
  buy?: number;
  sell?: number;
  /// Dùng cho world/fx (XAU theo USD, tỷ giá...).
  price?: number;
}

export interface ExtractResult {
  rows: ExtractedRow[];
  /// Dòng/trường bị bỏ qua kèm lý do — hiển thị khi admin chạy thử.
  warnings: string[];
}
