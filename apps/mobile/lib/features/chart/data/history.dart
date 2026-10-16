/// Một điểm lịch sử giá bán theo thời gian (đồng/lượng).
class HistoryPoint {
  const HistoryPoint({required this.at, required this.sell, this.buy});

  /// unix giây (tick) hoặc 00:00 giờ VN của ngày (daily).
  final int at;
  final int sell;
  final int? buy;
}

enum ChartRange {
  d1('1d', '1 ngày'),
  w1('1w', '1 tuần'),
  m1('1m', '1 tháng'),
  m3('3m', '3 tháng'),
  m6('6m', '6 tháng'),
  y1('1y', '1 năm');

  const ChartRange(this.query, this.label);
  final String query;
  final String label;
}

class HistorySeries {
  const HistorySeries({required this.points, required this.granularity});

  final List<HistoryPoint> points;

  /// 'tick' (1d/1w) hoặc 'daily'.
  final String granularity;
}
