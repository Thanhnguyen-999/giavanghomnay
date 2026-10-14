/// Giá một kim loại trên thị trường thế giới, kèm giá quy đổi.
class WorldPrice {
  const WorldPrice({
    required this.symbol,
    required this.usdPerOunce,
    required this.vndPerLuong,
    this.updatedAt,
  });

  /// 'XAU', 'XAG', ...
  final String symbol;
  final double usdPerOunce;

  /// Quy đổi theo tỷ giá, **không phải** giá vàng trong nước.
  final double vndPerLuong;

  /// Thời điểm nguồn cập nhật giá (nếu nguồn có trả).
  final DateTime? updatedAt;

  String get displayName => switch (symbol) {
    'XAU' => 'Vàng (XAU)',
    'XAG' => 'Bạc (XAG)',
    'XPT' => 'Bạch kim (XPT)',
    'XPD' => 'Palladium (XPD)',
    _ => symbol,
  };
}

/// Kết quả một lần tải giá thế giới.
class WorldSnapshot {
  const WorldSnapshot({required this.usdToVnd, required this.prices, required this.fetchedAt});

  final double usdToVnd;
  final List<WorldPrice> prices;
  final DateTime fetchedAt;
}
