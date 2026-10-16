import '../../../core/format/gold_units.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_exception.dart';
import 'world_snapshot.dart';

/// Lấy giá thế giới từ backend `/v1/world/latest` (do crawler tổng hợp).
/// Backend trả [{symbol, price_usd, usd_vnd, recorded_at}], gồm cả symbol 'USDVND'.
class BackendWorldRepository {
  BackendWorldRepository(this._api);

  final ApiClient _api;

  Future<WorldSnapshot> fetchSnapshot() async {
    final res = await _api.getJson('/v1/world/latest');
    final data = res.data;
    if (data is! List) {
      throw const ApiException('Dữ liệu giá thế giới không hợp lệ.');
    }

    double usdToVnd = 0;
    final metals = <Map<String, dynamic>>[];
    for (final row in data) {
      if (row is! Map<String, dynamic>) continue;
      final symbol = (row['symbol'] as String?)?.toUpperCase() ?? '';
      if (symbol == 'USDVND') {
        usdToVnd = (row['usd_vnd'] as num?)?.toDouble() ?? 0;
      } else {
        metals.add(row);
      }
    }

    final prices = <WorldPrice>[];
    for (final row in metals) {
      final symbol = (row['symbol'] as String).toUpperCase();
      final usd = (row['price_usd'] as num).toDouble();
      final rate = (row['usd_vnd'] as num?)?.toDouble() ?? usdToVnd;
      final recordedAt = (row['recorded_at'] as num?)?.toInt();
      prices.add(
        WorldPrice(
          symbol: symbol,
          usdPerOunce: usd,
          vndPerLuong: GoldUnits.perOunceToPerLuong(usd * rate),
          updatedAt: recordedAt == null
              ? null
              : DateTime.fromMillisecondsSinceEpoch(recordedAt * 1000),
        ),
      );
    }

    if (prices.isEmpty) {
      throw const ApiException('Chưa có giá thế giới. Vui lòng thử lại sau.');
    }
    return WorldSnapshot(usdToVnd: usdToVnd, prices: prices, fetchedAt: DateTime.now());
  }
}
