import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:giavanghomnay/app/app.dart';
import 'package:giavanghomnay/core/format/formatters.dart';
import 'package:giavanghomnay/core/network/api_exception.dart';
import 'package:giavanghomnay/features/world/data/world_snapshot.dart';
import 'package:giavanghomnay/features/world/presentation/world_providers.dart';

final _snapshot = WorldSnapshot(
  usdToVnd: 25000,
  fetchedAt: DateTime(2026, 10, 13, 9, 30),
  prices: const [
    WorldPrice(symbol: 'XAU', usdPerOunce: 4000, vndPerLuong: 120560000),
    WorldPrice(symbol: 'XAG', usdPerOunce: 50, vndPerLuong: 1507000),
  ],
);

Widget _app(Future<WorldSnapshot> Function() load) => ProviderScope(
  // Tắt retry tự động của Riverpod để test không còn timer treo.
  retry: (retryCount, error) => null,
  overrides: [worldSnapshotProvider.overrideWith((ref) => load())],
  child: const GoldPriceApp(),
);

void main() {
  testWidgets('mở tab Thế giới và hiển thị giá quy đổi', (tester) async {
    await tester.pumpWidget(_app(() async => _snapshot));
    await tester.pumpAndSettle();

    expect(find.text('Giá thế giới'), findsOneWidget);
    expect(find.text('Vàng (XAU)'), findsOneWidget);
    expect(find.text('Bạc (XAG)'), findsOneWidget);
    expect(find.text(formatVnd(120560000)), findsOneWidget);
    expect(find.textContaining('không phải giá vàng trong nước'), findsOneWidget);
  });

  testWidgets('hiển thị lỗi và nút thử lại khi tải thất bại', (tester) async {
    await tester.pumpWidget(_app(() async => throw const ApiException('Không có kết nối mạng')));
    await tester.pumpAndSettle();

    expect(find.text('Không tải được giá thế giới'), findsOneWidget);
    expect(find.text('Không có kết nối mạng'), findsOneWidget);
    expect(find.text('Thử lại'), findsOneWidget);
  });

  testWidgets('chuyển giữa các tab', (tester) async {
    await tester.pumpWidget(_app(() async => _snapshot));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Trong nước'));
    await tester.pumpAndSettle();
    expect(find.text('Giá vàng trong nước sắp có'), findsOneWidget);

    await tester.tap(find.text('Xem giá thế giới'));
    await tester.pumpAndSettle();
    expect(find.text('Vàng (XAU)'), findsOneWidget);

    await tester.tap(find.text('Tài khoản').last);
    await tester.pumpAndSettle();
    expect(find.text('Bạn đang xem ở chế độ khách'), findsOneWidget);
  });
}
