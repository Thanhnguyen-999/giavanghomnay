import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Một bản chụp đã cache kèm ETag để gọi lại server với If-None-Match.
class CachedSnapshot {
  const CachedSnapshot({required this.json, this.etag});

  final Object json;
  final String? etag;
}

/// Lưu/đọc snapshot JSON trên máy (shared_preferences). Dùng cho offline:
/// mở app hiển thị ngay dữ liệu cũ rồi gọi lại server.
class SnapshotCache {
  SnapshotCache(this._prefs);

  final SharedPreferences _prefs;

  CachedSnapshot? read(String key) {
    final raw = _prefs.getString('cache:$key');
    if (raw == null) return null;
    try {
      final decoded = jsonDecode(raw) as Map<String, dynamic>;
      return CachedSnapshot(json: decoded['json'] as Object, etag: decoded['etag'] as String?);
    } catch (_) {
      return null;
    }
  }

  Future<void> write(String key, {required Object json, String? etag}) async {
    await _prefs.setString('cache:$key', jsonEncode({'json': json, 'etag': etag}));
  }
}

/// Khởi tạo SharedPreferences một lần ở main và override provider này.
final sharedPreferencesProvider = Provider<SharedPreferences>((ref) {
  throw UnimplementedError('override sharedPreferencesProvider ở main()');
});

final snapshotCacheProvider = Provider<SnapshotCache>(
  (ref) => SnapshotCache(ref.watch(sharedPreferencesProvider)),
);
