import '../../../core/cache/snapshot_cache.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_exception.dart';
import 'domestic_price.dart';

/// Nối tab Trong nước vào `/v1/prices/latest`, cache-first + ETag.
class PriceRepository {
  PriceRepository(this._api, this._cache);

  static const _cacheKey = 'prices_latest';
  static const _path = '/v1/prices/latest';

  final ApiClient _api;
  final SnapshotCache _cache;

  /// Phát snapshot cache (nếu có) trước, rồi snapshot mới từ server.
  /// - 304: giữ nguyên cache (không phát lại).
  /// - lỗi mạng mà có cache: phát cache với cờ stale.
  /// - lỗi mạng không cache: ném ApiException.
  Stream<DomesticSnapshot> watchLatest() async* {
    final cached = _cache.read(_cacheKey);
    DomesticSnapshot? cachedSnapshot;
    if (cached != null) {
      cachedSnapshot = _decode(cached.json);
      if (cachedSnapshot != null) yield cachedSnapshot;
    }

    try {
      final res = await _api.getJson(_path, etag: cached?.etag);
      if (res.notModified) return;

      final envelope = {'data': res.data, 'updated_at': _updatedAtOf(res.data)};
      await _cache.write(_cacheKey, json: envelope, etag: res.etag);

      final fresh = _decode(envelope);
      if (fresh != null) yield fresh;
    } on ApiException {
      if (cachedSnapshot != null) {
        yield cachedSnapshot.copyWith(stale: true);
      } else {
        rethrow;
      }
    }
  }

  // Cache lưu dạng { data: [...], updated_at: n }.
  DomesticSnapshot? _decode(Object json) {
    if (json is! Map) return null;
    final data = json['data'];
    if (data is! List) return null;
    final updatedAt = (json['updated_at'] as num?)?.toInt() ?? 0;
    return DomesticSnapshot.fromData(data, updatedAt, fetchedAt: DateTime.now());
  }

  int _updatedAtOf(Object? data) {
    // meta.updated_at không nằm trong `data`; lấy max(changed_at) để ổn định ETag phía client.
    if (data is! List) return 0;
    var max = 0;
    for (final row in data) {
      if (row is Map && row['changed_at'] is num) {
        final v = (row['changed_at'] as num).toInt();
        if (v > max) max = v;
      }
    }
    return max;
  }
}
