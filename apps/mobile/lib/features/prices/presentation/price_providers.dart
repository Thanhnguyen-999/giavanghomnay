import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/cache/snapshot_cache.dart';
import '../../../core/config/env.dart';
import '../../../core/network/api_client.dart';
import '../data/domestic_price.dart';
import '../data/price_repository.dart';

final priceRepositoryProvider = Provider<PriceRepository>(
  (ref) => PriceRepository(ref.watch(apiClientProvider), ref.watch(snapshotCacheProvider)),
);

/// Có backend để gọi API trong nước không.
final hasBackendProvider = Provider<bool>((ref) => Env.hasBackend);

/// Bảng giá trong nước mới nhất (cache-first). Tự làm mới khi [refreshTickProvider] đổi.
final domesticLatestProvider = StreamProvider.autoDispose<DomesticSnapshot>((ref) {
  ref.watch(refreshTickProvider);
  return ref.watch(priceRepositoryProvider).watchLatest();
});

/// Bộ đếm làm mới: tăng để buộc tải lại (pull-to-refresh hoặc polling).
class RefreshTick extends Notifier<int> {
  @override
  int build() => 0;
  void bump() => state++;
}

final refreshTickProvider = NotifierProvider<RefreshTick, int>(RefreshTick.new);

/// Poll định kỳ khi app ở foreground. Gắn một lần ở widget gốc của tab.
class PricePoller {
  PricePoller(this._ref, {this.interval = const Duration(seconds: 60)});

  final Ref _ref;
  final Duration interval;
  Timer? _timer;
  AppLifecycleListener? _lifecycle;

  void start() {
    _lifecycle = AppLifecycleListener(
      onStateChange: (state) {
        if (state == AppLifecycleState.resumed) {
          _refresh();
          _resume();
        } else {
          _pause();
        }
      },
    );
    _resume();
  }

  void _resume() {
    _timer ??= Timer.periodic(interval, (_) => _refresh());
  }

  void _pause() {
    _timer?.cancel();
    _timer = null;
  }

  void _refresh() {
    _ref.read(refreshTickProvider.notifier).bump();
  }

  void dispose() {
    _pause();
    _lifecycle?.dispose();
  }
}

final pricePollerProvider = Provider.autoDispose<PricePoller>((ref) {
  final poller = PricePoller(ref);
  poller.start();
  ref.onDispose(poller.dispose);
  return poller;
});
