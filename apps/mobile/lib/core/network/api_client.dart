import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/env.dart';
import 'api_exception.dart';
import 'dio_provider.dart';

/// Kết quả một lần GET có hỗ trợ ETag.
class ApiResponse<T> {
  const ApiResponse({required this.data, this.etag, this.notModified = false});

  /// null khi notModified = true.
  final T? data;
  final String? etag;
  final bool notModified;
}

/// Client đọc API `/v1/*` của backend gold-api.
class ApiClient {
  ApiClient(this._dio, {required this.baseUrl});

  final Dio _dio;
  final String baseUrl;

  bool get hasBackend => baseUrl.isNotEmpty;

  /// GET trả JSON `{ data, meta }`. Nếu truyền [etag] và server trả 304,
  /// `notModified = true` và `data = null`.
  Future<ApiResponse<Object?>> getJson(String path, {String? etag}) async {
    if (!hasBackend) {
      throw const ApiException('Chưa cấu hình máy chủ (API_BASE_URL).');
    }
    final headers = <String, String>{};
    if (etag != null) headers['If-None-Match'] = etag;
    try {
      final res = await _dio.get<Object?>(
        '$baseUrl$path',
        options: Options(
          headers: headers,
          validateStatus: (s) => s != null && (s == 304 || (s >= 200 && s < 300)),
        ),
      );
      if (res.statusCode == 304) {
        return const ApiResponse(data: null, notModified: true);
      }
      final body = res.data;
      final data = body is Map<String, dynamic> ? body['data'] : null;
      return ApiResponse(data: data, etag: res.headers.value('etag'));
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}

final apiClientProvider = Provider<ApiClient>(
  (ref) => ApiClient(ref.watch(dioProvider), baseUrl: Env.apiBaseUrl),
);
