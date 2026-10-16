import '../../../core/network/api_client.dart';
import 'history.dart';

/// Tải lịch sử giá cho biểu đồ từ `/v1/prices/:id/history`.
class HistoryRepository {
  HistoryRepository(this._api);

  final ApiClient _api;

  Future<HistorySeries> fetch(String productId, ChartRange range) async {
    final res = await _api.getJson('/v1/prices/$productId/history?range=${range.query}');
    final data = res.data;
    if (data is! List) {
      return const HistorySeries(points: [], granularity: 'tick');
    }

    final points = <HistoryPoint>[];
    var granularity = 'tick';
    for (final row in data) {
      if (row is! Map) continue;
      if (row.containsKey('recorded_at')) {
        // tick: { recorded_at, buy, sell }
        points.add(
          HistoryPoint(
            at: (row['recorded_at'] as num).toInt(),
            sell: (row['sell'] as num).toInt(),
            buy: (row['buy'] as num?)?.toInt(),
          ),
        );
      } else if (row.containsKey('day')) {
        // daily: { day 'YYYY-MM-DD', close_sell, close_buy, ... }
        granularity = 'daily';
        final day = row['day'] as String;
        points.add(
          HistoryPoint(
            at: DateTime.parse('${day}T00:00:00+07:00').millisecondsSinceEpoch ~/ 1000,
            sell: (row['close_sell'] as num).toInt(),
            buy: (row['close_buy'] as num?)?.toInt(),
          ),
        );
      }
    }
    return HistorySeries(points: points, granularity: granularity);
  }
}
