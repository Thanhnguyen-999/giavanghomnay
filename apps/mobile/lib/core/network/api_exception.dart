import 'package:dio/dio.dart';

/// Lỗi mạng/API đã được chuyển thành thông điệp hiển thị được cho người dùng.
class ApiException implements Exception {
  const ApiException(this.message, {this.statusCode, this.retryable = false});

  factory ApiException.fromDio(DioException e) {
    final status = e.response?.statusCode;
    return switch (e.type) {
      DioExceptionType.connectionTimeout ||
      DioExceptionType.sendTimeout ||
      DioExceptionType.receiveTimeout => const ApiException(
        'Máy chủ phản hồi quá lâu. Vui lòng thử lại.',
        retryable: true,
      ),
      DioExceptionType.connectionError => const ApiException(
        'Không có kết nối mạng hoặc không truy cập được máy chủ.',
        retryable: true,
      ),
      DioExceptionType.badResponse when status == 429 => const ApiException(
        'Nguồn dữ liệu đang giới hạn số lần truy cập. Vui lòng thử lại sau ít phút.',
        statusCode: 429,
      ),
      DioExceptionType.badResponse => ApiException(
        'Máy chủ trả lỗi ($status).',
        statusCode: status,
        retryable: status != null && status >= 500,
      ),
      DioExceptionType.cancel => const ApiException('Yêu cầu đã bị hủy.'),
      _ => const ApiException('Không tải được dữ liệu.'),
    };
  }

  final String message;
  final int? statusCode;

  /// Lỗi tạm thời (mất mạng, timeout, 5xx): thử lại tự động có ý nghĩa.
  /// Lỗi 4xx (gồm 429) thì không, vì thử lại chỉ làm tình hình tệ hơn.
  final bool retryable;

  @override
  String toString() => message;
}
