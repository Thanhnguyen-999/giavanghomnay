import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/format/formatters.dart';
import '../../../shared/widgets/message_view.dart';
import '../data/domestic_price.dart';
import 'price_providers.dart';

class PricesPage extends ConsumerWidget {
  const PricesPage({super.key, this.onOpenWorld});

  final VoidCallback? onOpenWorld;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final hasBackend = ref.watch(hasBackendProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Giá Vàng Hôm Nay')),
      body: hasBackend ? _Body(onOpenWorld: onOpenWorld) : _NoBackend(onOpenWorld: onOpenWorld),
    );
  }
}

class _NoBackend extends StatelessWidget {
  const _NoBackend({this.onOpenWorld});
  final VoidCallback? onOpenWorld;

  @override
  Widget build(BuildContext context) {
    return MessageView(
      icon: Icons.cloud_off,
      title: 'Chưa kết nối máy chủ',
      message:
          'Bản dựng này chưa cấu hình máy chủ giá trong nước. '
          'Bạn vẫn có thể xem giá thế giới.',
      actionLabel: onOpenWorld == null ? null : 'Xem giá thế giới',
      onAction: onOpenWorld,
    );
  }
}

class _Body extends ConsumerWidget {
  const _Body({this.onOpenWorld});
  final VoidCallback? onOpenWorld;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(pricePollerProvider); // bật polling khi tab hiển thị
    final state = ref.watch(domesticLatestProvider);
    final snapshot = state.value;

    Future<void> refresh() async {
      ref.read(refreshTickProvider.notifier).bump();
      try {
        await ref.read(domesticLatestProvider.future);
      } catch (_) {
        // Lỗi đã phản ánh trong state của provider và hiển thị bên dưới.
      }
    }

    final Widget body;
    if (snapshot != null && snapshot.prices.isNotEmpty) {
      body = _PriceList(snapshot: snapshot);
    } else if (snapshot != null) {
      body = _ScrollFill(
        child: MessageView(
          icon: Icons.hourglass_empty,
          title: 'Giá trong nước đang cập nhật',
          message:
              'Chưa có nguồn giá trong nước nào hoạt động. '
              'Quản trị viên cần thêm nguồn, hoặc bạn xem tạm giá thế giới.',
          actionLabel: onOpenWorld == null ? null : 'Xem giá thế giới',
          onAction: onOpenWorld,
        ),
      );
    } else if (state.hasError) {
      body = _ScrollFill(
        child: MessageView(
          icon: Icons.error_outline,
          title: 'Không tải được giá',
          message: '${state.error}',
          actionLabel: 'Thử lại',
          onAction: refresh,
        ),
      );
    } else {
      body = const Center(child: CircularProgressIndicator());
    }

    return RefreshIndicator(onRefresh: refresh, child: body);
  }
}

class _PriceList extends StatelessWidget {
  const _PriceList({required this.snapshot});
  final DomesticSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final byBrand = <String, List<DomesticPrice>>{};
    for (final p in snapshot.prices) {
      byBrand.putIfAbsent(p.brandId, () => []).add(p);
    }

    final children = <Widget>[
      if (snapshot.stale)
        Card(
          color: theme.colorScheme.errorContainer,
          child: ListTile(
            leading: Icon(Icons.wifi_off, color: theme.colorScheme.onErrorContainer),
            title: Text(
              'Đang hiển thị dữ liệu đã lưu (mất kết nối).',
              style: TextStyle(color: theme.colorScheme.onErrorContainer),
            ),
          ),
        ),
      Padding(
        padding: const EdgeInsets.fromLTRB(4, 4, 4, 8),
        child: Text(
          'Cập nhật lúc ${formatDateTime(snapshot.fetchedAt)} · giá tham khảo',
          style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
        ),
      ),
    ];

    for (final entry in byBrand.entries) {
      children.add(
        Padding(
          padding: const EdgeInsets.fromLTRB(4, 8, 4, 4),
          child: Text(
            entry.key.toUpperCase(),
            style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold),
          ),
        ),
      );
      for (final p in entry.value) {
        children.add(_PriceTile(price: p));
      }
    }

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(12),
      children: children,
    );
  }
}

class _PriceTile extends StatelessWidget {
  const _PriceTile({required this.price});
  final DomesticPrice price;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final trend = price.sellTrend;
    final trendColor = trend > 0
        ? const Color(0xFF00853E)
        : trend < 0
        ? const Color(0xFFD50000)
        : theme.colorScheme.onSurfaceVariant;
    final trendIcon = trend > 0
        ? Icons.arrow_upward
        : trend < 0
        ? Icons.arrow_downward
        : Icons.remove;
    final delta = price.sellDelta;
    final deltaText = delta == null || delta == 0
        ? ''
        : '${delta > 0 ? '+' : '−'}${formatVnd(delta.abs())}';

    final semantics =
        '${price.name}${price.region != null ? ' khu vực ${price.region}' : ''}: '
        'mua ${formatVnd(price.buy)}, bán ${formatVnd(price.sell)}'
        '${trend > 0
            ? ', tăng'
            : trend < 0
            ? ', giảm'
            : ''}';

    return Card(
      child: Semantics(
        label: semantics,
        excludeSemantics: true,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(price.name, style: const TextStyle(fontWeight: FontWeight.bold)),
                    if (price.region != null) Text(price.region!, style: theme.textTheme.bodySmall),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text('Mua ${formatVnd(price.buy)}', style: theme.textTheme.bodyMedium),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(trendIcon, size: 14, color: trendColor),
                      const SizedBox(width: 2),
                      Text(
                        'Bán ${formatVnd(price.sell)}',
                        style: theme.textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.bold,
                          color: trendColor,
                        ),
                      ),
                    ],
                  ),
                  if (deltaText.isNotEmpty)
                    Text(deltaText, style: theme.textTheme.bodySmall?.copyWith(color: trendColor)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Cho phép kéo-làm-mới khi nội dung chỉ là một thông báo.
class _ScrollFill extends StatelessWidget {
  const _ScrollFill({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) => SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: constraints.maxHeight),
          child: child,
        ),
      ),
    );
  }
}
