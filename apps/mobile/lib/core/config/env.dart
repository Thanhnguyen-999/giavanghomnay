/// Cấu hình build-time, truyền qua `--dart-define`.
///
/// Ví dụ:
/// ```bash
/// flutter run --dart-define=API_BASE_URL=https://gold-api.<account>.workers.dev
/// ```
abstract final class Env {
  /// URL của Worker `gold-api`. Rỗng cho tới khi backend được deploy (Phase 1).
  static const apiBaseUrl = String.fromEnvironment('API_BASE_URL');

  /// Key GoldAPI (tùy chọn). Có key thì giá XAU lấy trực tiếp theo VND từ goldapi.io.
  static const goldApiKey = String.fromEnvironment('GOLD_API_KEY');

  static bool get hasBackend => apiBaseUrl.isNotEmpty;
}
