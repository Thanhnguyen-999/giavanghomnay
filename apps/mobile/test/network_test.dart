import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:giavanghomnay/core/network/api_exception.dart';
import 'package:giavanghomnay/core/network/retry_policy.dart';

DioException _badResponse(int status) {
  final options = RequestOptions(path: '/price/XAU');
  return DioException.badResponse(
    statusCode: status,
    requestOptions: options,
    response: Response(requestOptions: options, statusCode: status),
  );
}

void main() {
  group('ApiException.fromDio', () {
    test('429 có thông điệp riêng và không retry', () {
      final e = ApiException.fromDio(_badResponse(429));
      expect(e.statusCode, 429);
      expect(e.message, contains('giới hạn số lần truy cập'));
      expect(e.retryable, isFalse);
    });

    test('5xx được retry, 4xx thì không', () {
      expect(ApiException.fromDio(_badResponse(503)).retryable, isTrue);
      expect(ApiException.fromDio(_badResponse(404)).retryable, isFalse);
    });

    test('mất kết nối được retry', () {
      final e = ApiException.fromDio(
        DioException.connectionError(
          requestOptions: RequestOptions(path: '/'),
          reason: 'offline',
        ),
      );
      expect(e.retryable, isTrue);
    });
  });

  group('appRetry', () {
    const transient = ApiException('offline', retryable: true);
    const rateLimited = ApiException('429', statusCode: 429);

    test('lỗi tạm thời: backoff 1s, 2s, 4s rồi dừng', () {
      expect(appRetry(0, transient), const Duration(seconds: 1));
      expect(appRetry(1, transient), const Duration(seconds: 2));
      expect(appRetry(2, transient), const Duration(seconds: 4));
      expect(appRetry(3, transient), isNull);
    });

    test('không retry lỗi 429 hoặc lỗi không phải ApiException', () {
      expect(appRetry(0, rateLimited), isNull);
      expect(appRetry(0, StateError('bug')), isNull);
    });
  });
}
