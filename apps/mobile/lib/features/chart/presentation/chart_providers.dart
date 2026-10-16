import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../prices/presentation/price_providers.dart';
import '../data/history.dart';
import '../data/history_repository.dart';

final historyRepositoryProvider = Provider<HistoryRepository>(
  (ref) => HistoryRepository(ref.watch(apiClientProvider)),
);

/// Sản phẩm tối giản để chọn trong tab Biểu đồ.
class ProductRef {
  const ProductRef({required this.id, required this.name});
  final String id;
  final String name;
}

/// Danh sách sản phẩm đang hoạt động (từ /v1/products).
final productsProvider = FutureProvider.autoDispose<List<ProductRef>>((ref) async {
  if (!ref.watch(hasBackendProvider)) return const [];
  final res = await ref.watch(apiClientProvider).getJson('/v1/products');
  final data = res.data;
  if (data is! List) return const [];
  return data
      .whereType<Map<String, dynamic>>()
      .map((j) => ProductRef(id: j['id'] as String, name: j['name'] as String))
      .toList(growable: false);
});

/// Sản phẩm + khung thời gian đang chọn.
class ChartSelection {
  const ChartSelection({this.productId, this.range = ChartRange.m1});
  final String? productId;
  final ChartRange range;

  ChartSelection copyWith({String? productId, ChartRange? range}) =>
      ChartSelection(productId: productId ?? this.productId, range: range ?? this.range);
}

class ChartSelectionNotifier extends Notifier<ChartSelection> {
  @override
  ChartSelection build() => const ChartSelection();
  void selectProduct(String id) => state = state.copyWith(productId: id);
  void selectRange(ChartRange r) => state = state.copyWith(range: r);
}

final chartSelectionProvider = NotifierProvider<ChartSelectionNotifier, ChartSelection>(
  ChartSelectionNotifier.new,
);

/// Chuỗi lịch sử theo lựa chọn hiện tại.
final historySeriesProvider = FutureProvider.autoDispose<HistorySeries>((ref) async {
  final sel = ref.watch(chartSelectionProvider);
  final id = sel.productId;
  if (id == null) return const HistorySeries(points: [], granularity: 'tick');
  return ref.watch(historyRepositoryProvider).fetch(id, sel.range);
});
