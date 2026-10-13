import 'dart:convert';

import 'package:http/http.dart' as http;

class GoldPrice {
  final String metal;
  final double priceUsdPerOunce;

  GoldPrice({required this.metal, required this.priceUsdPerOunce});
}

class GoldApi {
  // Best-supported source for real VND gold price is a registered provider with an API key.
  // Exact Vietnam SJC gold price is not publicly available via a free official API.
  // This integration tries GoldAPI first (if a key is supplied), then falls back to public market data.
  static const _goldApiUrl = 'https://www.goldapi.io/api/XAU/VND';
  static const _metalsUrl = 'https://api.metals.live/v1/spot';
  static const _fxUrl = 'https://api.exchangerate.host/latest?base=USD&symbols=VND';

  static String get apiKey => const String.fromEnvironment(
        'GOLD_API_KEY',
        defaultValue: '',
      );

  static Future<double> _fetchUsdToVnd() async {
    final r = await http.get(Uri.parse(_fxUrl));
    if (r.statusCode != 200) throw Exception('FX request failed: ${r.statusCode}');
    final j = json.decode(r.body);
    if (j is Map && j['rates'] != null && j['rates']['VND'] != null) {
      return (j['rates']['VND'] as num).toDouble();
    }
    throw Exception('Unexpected FX response');
  }

  static Future<List<GoldPrice>> fetchSpotPrices() async {
    final r = await http.get(Uri.parse(_metalsUrl));
    if (r.statusCode != 200) throw Exception('Metals request failed: ${r.statusCode}');

    final j = json.decode(r.body);
    final List<GoldPrice> prices = [];

    if (j is List) {
      for (final entry in j) {
        if (entry is Map) {
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

  static Future<Map<String, double>> fetchVndPerLuong() async {
    final key = apiKey;
    if (key.isNotEmpty) {
      try {
        final r = await http.get(
          Uri.parse(_goldApiUrl),
          headers: {'x-access-token': key},
        );

        if (r.statusCode == 200) {
          final j = json.decode(r.body);
          if (j is Map && j['price'] != null) {
            final priceInVndPerOunce = (j['price'] as num).toDouble();
            const gramsPerOunce = 31.1034768;
            const gramsPerLuong = 37.5;
            final factor = gramsPerLuong / gramsPerOunce;
            return {'GOLD': priceInVndPerOunce * factor};
          }
        }
      } catch (_) {
        // Fall through to public market API below.
      }
    }

    final usdToVnd = await _fetchUsdToVnd();
    final spot = await fetchSpotPrices();
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
