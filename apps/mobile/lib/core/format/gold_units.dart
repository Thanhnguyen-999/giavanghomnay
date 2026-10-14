/// Quy đổi đơn vị vàng.
///
/// 1 troy ounce = 31,1034768 g; 1 lượng (cây) = 37,5 g; 1 lượng = 10 chỉ.
abstract final class GoldUnits {
  static const gramsPerTroyOunce = 31.1034768;
  static const gramsPerLuong = 37.5;
  static const luongPerTroyOunce = gramsPerTroyOunce / gramsPerLuong;

  /// Giá theo ounce → giá theo lượng (cùng đơn vị tiền).
  static double perOunceToPerLuong(double pricePerOunce) => pricePerOunce / luongPerTroyOunce;
}
