import 'dart:convert';

import 'package:dio/dio.dart';

import '../../../core/format/gold_units.dart';
import '../../../core/network/api_exception.dart';
import 'world_snapshot.dart';

/// Giá thế giới lấy trực tiếp từ nguồn công khai (không cần key).
///
/// Tạm thời cho tới khi backend có `/v1/world/latest` (Phase 1), khi đó
/// repository này chuyển sang gọi API của mình.
class WorldPriceRepository {
  WorldPriceRepository(this._dio, {String goldApiKey = ''}) : _goldApiKey = goldApiKey;

  static const symbols = ['XAU', 'XAG'];

  static const _fxUrl = 'https://open.er-api.com/v6/latest/USD';
  static const _spotBaseUrl = 'https://api.gold-api.com/price';
  static const _goldApiUrl = 'https://www.goldapi.io/api/XAU/VND';

  final Dio _dio;
  final String _goldApiKey;

  Future<WorldSnapshot> fetchSnapshot() async {
    try {
      // Chạy song song. Mỗi symbol được "settle" riêng: một symbol lỗi không làm hỏng cả màn hình.
      final results = await Future.wait<Object?>([
        _fetchUsdToVnd(),
        Future.wait(symbols.map((s) => _settle(_fetchSpot(s)))),
        _fetchGoldApiXauVndPerOunce(),
      ]);

      final usdToVnd = results[0]! as double;
      final spotResults = results[1]! as List<Object>;
      final spots = spotResults.whereType<_Spot>().toList();
      final xauVndPerOunce = results[2] as double?;

      if (spots.isEmpty) {
        // Ném lại lỗi thật (vd. 429) để người dùng thấy đúng nguyên nhân.
        throw spotResults.first;
      }

      final prices = [
        for (final s in spots)
          WorldPrice(
            symbol: s.symbol,
            usdPerOunce: s.usdPerOunce,
            vndPerLuong: GoldUnits.perOunceToPerLuong(
              s.symbol == 'XAU' && xauVndPerOunce != null
                  ? xauVndPerOunce
                  : s.usdPerOunce * usdToVnd,
            ),
            updatedAt: s.updatedAt,
          ),
      ];

      return WorldSnapshot(usdToVnd: usdToVnd, prices: prices, fetchedAt: DateTime.now());
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    } on FormatException {
      throw const ApiException('Dữ liệu từ nguồn không đúng định dạng.');
    }
  }

  Future<double> _fetchUsdToVnd() async {
    final json = _asMap((await _dio.get<Object?>(_fxUrl)).data);
    final rates = json['rates'];
    final vnd = rates is Map ? rates['VND'] : null;
    if (vnd is! num) throw const FormatException('Thiếu tỷ giá VND');
    return vnd.toDouble();
  }

  Future<_Spot> _fetchSpot(String symbol) async {
    final json = _asMap((await _dio.get<Object?>('$_spotBaseUrl/$symbol')).data);
    final price = json['price'];
    if (price is! num) throw FormatException('Thiếu giá $symbol');
    return _Spot(
      symbol: (json['symbol'] as String?)?.toUpperCase() ?? symbol,
      usdPerOunce: price.toDouble(),
      updatedAt: DateTime.tryParse(json['updatedAt'] as String? ?? ''),
    );
  }

  /// Trả về kết quả hoặc lỗi (DioException/FormatException) thay vì ném ra.
  static Future<Object> _settle(Future<_Spot> future) async {
    try {
      return await future;
    } on DioException catch (e) {
      return e;
    } on FormatException catch (e) {
      return e;
    }
  }

  /// Giá XAU theo VND/ounce từ goldapi.io; chỉ gọi khi có key, lỗi thì bỏ qua.
  Future<double?> _fetchGoldApiXauVndPerOunce() async {
    if (_goldApiKey.isEmpty) return null;
    try {
      final response = await _dio.get<Object?>(
        _goldApiUrl,
        options: Options(headers: {'x-access-token': _goldApiKey}),
      );
      final price = _asMap(response.data)['price'];
      return price is num ? price.toDouble() : null;
    } on DioException {
      return null;
    } on FormatException {
      return null;
    }
  }

  /// Một số nguồn trả JSON với content-type text/plain → Dio trả String.
  static Map<String, dynamic> _asMap(Object? data) {
    final decoded = data is String ? jsonDecode(data) : data;
    if (decoded is Map<String, dynamic>) return decoded;
    throw const FormatException('Phản hồi không phải JSON object');
  }
}

class _Spot {
  const _Spot({required this.symbol, required this.usdPerOunce, this.updatedAt});

  final String symbol;
  final double usdPerOunce;
  final DateTime? updatedAt;
}
