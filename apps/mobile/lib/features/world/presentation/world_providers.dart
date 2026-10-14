import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/config/env.dart';
import '../../../core/network/dio_provider.dart';
import '../data/world_price_repository.dart';
import '../data/world_snapshot.dart';

final worldPriceRepositoryProvider = Provider<WorldPriceRepository>(
  (ref) => WorldPriceRepository(ref.watch(dioProvider), goldApiKey: Env.goldApiKey),
);

final worldSnapshotProvider = FutureProvider<WorldSnapshot>(
  (ref) => ref.watch(worldPriceRepositoryProvider).fetchSnapshot(),
);
