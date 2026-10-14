import 'api_exception.dart';

/// Chính sách retry cho Riverpod (truyền vào `ProviderScope.retry`).
///
/// Mặc định Riverpod 3 thử lại mọi lỗi nhiều lần. Ở đây chỉ thử lại lỗi tạm thời,
/// tối đa 3 lần (1s, 2s, 4s), để không dồn thêm request khi nguồn đang giới hạn (429).
Duration? appRetry(int retryCount, Object error) {
  if (retryCount >= 3) return null;
  if (error is ApiException && error.retryable) {
    return Duration(seconds: 1 << retryCount);
  }
  return null;
}
