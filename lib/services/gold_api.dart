import 'dart:convert';

import 'package:http/http.dart' as http;

class GoldPrice {
  final String metal; // e.g. XAU
  final double priceUsdPerOunce;

  GoldPrice({required this.metal, required this.priceUsdPerOunce});
}

class GoldApi {
  // Public endpoints used (no API key required):
  // - Spot metals: https://api.metals.live/v1/spot
  // - FX rates: https://api.exchangerate.host/latest?base=USD&symbols=VND

  static const _metalsUrl = 'https://api.metals.live/v1/spot';
  static const _fxUrl = 'https://api.exchangerate.host/latest?base=USD&symbols=VND';

  /// Fetch USD -> VND exchange rate
  static Future<double> _fetchUsdToVnd() async {
    final r = await http.get(Uri.parse(_fxUrl));
    if (r.statusCode != 200) throw Exception('FX request failed: ${r.statusCode}');
    final j = json.decode(r.body);
    if (j is Map && j['rates'] != null && j['rates']['VND'] != null) {
      return (j['rates']['VND'] as num).toDouble();
    }
    throw Exception('Unexpected FX response');
  }

  /// Fetch spot metals prices from metals.live
  static Future<List<GoldPrice>> fetchSpotPrices() async {
    final r = await http.get(Uri.parse(_metalsUrl));
    if (r.statusCode != 200) throw Exception('Metals request failed: ${r.statusCode}');

    final j = json.decode(r.body);
    final List<GoldPrice> prices = [];

    if (j is List) {
      for (final entry in j) {
        if (entry is Map) {
          // metals.live returns objects like {"metal":"gold","currency":"USD","price":...}
          String? metal;
          double? price;

          if (entry.containsKey('metal')) metal = (entry['metal'] ?? '').toString();
          if (entry.containsKey('symbol')) metal = (entry['symbol'] ?? metal)?.toString();

          if (entry.containsKey('price')) price = (entry['price'] as num?)?.toDouble();
          if (entry.containsKey('value')) price = (entry['value'] as num?)?.toDouble();
          if (entry.containsKey('ask')) price = (entry['ask'] as num?)?.toDouble();

          if (metal != null && price != null) {
            prices.add(GoldPrice(metal: metal.toUpperCase(), priceUsdPerOunce: price));
          }
        }
      }
    }

    if (prices.isEmpty) throw Exception('No prices parsed from metals API');

    return prices;
  }

  /// Returns map of metal -> VND per lượng (lượng = 37.5g)
  static Future<Map<String, double>> fetchVndPerLuong() async {
    final usdToVnd = await _fetchUsdToVnd();
    final spot = await fetchSpotPrices();

    // Conversion: price_usd_per_ounce -> price_vnd_per_luong
    // 1 troy ounce = 31.1034768 g
    // 1 lượng (tael) = 37.5 g
    // price_per_luong = price_per_ounce * (37.5 / 31.1034768) * usdToVnd
    const gramsPerOunce = 31.1034768;
    const gramsPerLuong = 37.5;
    final factor = gramsPerLuong / gramsPerOunce;

    final Map<String, double> result = {};
    for (final p in spot) {
      result[p.metal] = p.priceUsdPerOunce * factor * usdToVnd;
    }

    return result;
  }
}
