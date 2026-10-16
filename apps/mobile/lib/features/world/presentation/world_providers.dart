import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/config/env.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/dio_provider.dart';
import '../../prices/presentation/price_providers.dart';
import '../data/backend_world_repository.dart';
import '../data/world_price_repository.dart';
import '../data/world_snapshot.dart';

/// Nguồn trực tiếp (gold-api + er-api) — fallback khi chưa có backend.
final worldPriceRepositoryProvider = Provider<WorldPriceRepository>(
  (ref) => WorldPriceRepository(ref.watch(dioProvider), goldApiKey: Env.goldApiKey),
);

/// Nguồn qua backend `/v1/world/latest`.
final backendWorldRepositoryProvider = Provider<BackendWorldRepository>(
  (ref) => BackendWorldRepository(ref.watch(apiClientProvider)),
);

/// Giá thế giới: ưu tiên backend khi có API_BASE_URL, nếu không gọi nguồn trực tiếp.
final worldSnapshotProvider = FutureProvider<WorldSnapshot>((ref) {
  if (ref.watch(hasBackendProvider)) {
    return ref.watch(backendWorldRepositoryProvider).fetchSnapshot();
  }
  return ref.watch(worldPriceRepositoryProvider).fetchSnapshot();
});
