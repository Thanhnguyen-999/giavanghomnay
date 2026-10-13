import 'package:flutter_test/flutter_test.dart';
import 'package:giavanghomnay/main.dart';

void main() {
  testWidgets('App loads and shows main title', (WidgetTester tester) async {
    await tester.pumpWidget(const GoldPriceApp());

    expect(find.text('Giá Vàng Hôm Nay'), findsOneWidget);
    expect(find.text('Tổng quan'), findsOneWidget);
  });
}
