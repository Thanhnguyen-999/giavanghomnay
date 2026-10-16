/// Giá một sản phẩm vàng trong nước (đồng/lượng).
class DomesticPrice {
  const DomesticPrice({
    required this.productId,
    required this.brandId,
    required this.name,
    required this.kind,
    this.region,
    required this.buy,
    required this.sell,
    this.prevBuy,
    this.prevSell,
    required this.changedAt,
    required this.checkedAt,
    required this.sourceId,
  });

  final String productId;
  final String brandId;
  final String name;
  final String kind;
  final String? region;
  final int buy;
  final int sell;
  final int? prevBuy;
  final int? prevSell;
  final int changedAt;
  final int checkedAt;
  final String sourceId;

  /// Chiều thay đổi giá bán so với lần trước: 1 tăng, -1 giảm, 0 không đổi/không rõ.
  int get sellTrend {
    if (prevSell == null) return 0;
    return sell.compareTo(prevSell!);
  }

  int? get sellDelta => prevSell == null ? null : sell - prevSell!;

  factory DomesticPrice.fromJson(Map<String, dynamic> j) => DomesticPrice(
    productId: j['product_id'] as String,
    brandId: j['brand_id'] as String,
    name: j['name'] as String,
    kind: j['kind'] as String,
    region: j['region'] as String?,
    buy: (j['buy'] as num).toInt(),
    sell: (j['sell'] as num).toInt(),
    prevBuy: (j['prev_buy'] as num?)?.toInt(),
    prevSell: (j['prev_sell'] as num?)?.toInt(),
    changedAt: (j['changed_at'] as num).toInt(),
    checkedAt: (j['checked_at'] as num).toInt(),
    sourceId: j['source_id'] as String,
  );
}

/// Kết quả một lần tải bảng giá trong nước.
class DomesticSnapshot {
  const DomesticSnapshot({
    required this.prices,
    required this.updatedAt,
    required this.fetchedAt,
    this.stale = false,
  });

  final List<DomesticPrice> prices;

  /// `meta.updated_at` từ server (unix giây), 0 nếu chưa có.
  final int updatedAt;

  /// Thời điểm máy nhận dữ liệu.
  final DateTime fetchedAt;

  /// true khi đang hiển thị dữ liệu cache do mạng lỗi.
  final bool stale;

  DomesticSnapshot copyWith({bool? stale}) => DomesticSnapshot(
    prices: prices,
    updatedAt: updatedAt,
    fetchedAt: fetchedAt,
    stale: stale ?? this.stale,
  );

  static DomesticSnapshot fromData(
    List<dynamic> data,
    int updatedAt, {
    required DateTime fetchedAt,
  }) {
    return DomesticSnapshot(
      prices: data
          .whereType<Map<String, dynamic>>()
          .map(DomesticPrice.fromJson)
          .toList(growable: false),
      updatedAt: updatedAt,
      fetchedAt: fetchedAt,
    );
  }
}
