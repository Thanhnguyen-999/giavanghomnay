import 'package:flutter/material.dart';

abstract final class AppTheme {
  /// Vàng đậm làm màu gốc; #FFD700 quá nhạt để làm màu chữ trên nền sáng.
  static const _seed = Color(0xFFB8860B);

  static ThemeData light() =>
      ThemeData(colorScheme: ColorScheme.fromSeed(seedColor: _seed), useMaterial3: true);

  static ThemeData dark() => ThemeData(
    colorScheme: ColorScheme.fromSeed(seedColor: _seed, brightness: Brightness.dark),
    useMaterial3: true,
  );
}
