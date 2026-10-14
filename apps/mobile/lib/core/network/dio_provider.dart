import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// User-Agent nhận diện app. Không dùng mặc định `Dart/x.y (dart:io)`:
/// gold-api.com giới hạn chung UA đó cho mọi client Dart nên thường trả 429.
const appUserAgent = 'GiaVangHomNay (+https://thanhnguyen-999.github.io/)';

/// Dio dùng chung cho toàn app.
final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(
    BaseOptions(
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 15),
      headers: {'Accept': 'application/json', 'User-Agent': appUserAgent},
    ),
  );
  ref.onDispose(dio.close);
  return dio;
});
