import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/format/formatters.dart';
import '../../../shared/widgets/message_view.dart';
import '../data/world_snapshot.dart';
import 'world_providers.dart';

class WorldPage extends ConsumerWidget {
  const WorldPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(worldSnapshotProvider);
    final data = state.value;

    Future<void> refresh() async {
      try {
        ref.invalidate(worldSnapshotProvider);
        await ref.read(worldSnapshotProvider.future);
      } catch (_) {
        // Lỗi đã nằm trong state của provider và được hiển thị bên dưới.
      }
    }

    final Widget body;
    if (data != null) {
      body = _WorldList(snapshot: data, errorMessage: state.hasError ? '${state.error}' : null);
    } else if (state.hasError) {
      body = _ScrollableCenter(
        child: MessageView(
          icon: Icons.cloud_off,
          title: 'Không tải được giá thế giới',
          message: '${state.error}',
          actionLabel: 'Thử lại',
          onAction: refresh,
        ),
      );
    } else {
      body = const Center(child: CircularProgressIndicator());
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Giá thế giới')),
      body: RefreshIndicator(onRefresh: refresh, child: body),
    );
  }
}

class _WorldList extends StatelessWidget {
  const _WorldList({required this.snapshot, this.errorMessage});

  final WorldSnapshot snapshot;
  final String? errorMessage;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final muted = theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant);

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(16),
      children: [
        if (errorMessage != null)
          Card(
            color: theme.colorScheme.errorContainer,
            child: ListTile(
              leading: Icon(Icons.warning_amber, color: theme.colorScheme.onErrorContainer),
              title: Text(
                'Đang hiển thị dữ liệu cũ: $errorMessage',
                style: TextStyle(color: theme.colorScheme.onErrorContainer),
              ),
            ),
          ),
        Card(
          color: theme.colorScheme.secondaryContainer,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Text(
              'Giá thế giới quy đổi theo tỷ giá, chỉ mang tính tham khảo. '
              'Đây không phải giá vàng trong nước (SJC, DOJI, PNJ...).',
              style: TextStyle(color: theme.colorScheme.onSecondaryContainer),
            ),
          ),
        ),
        const SizedBox(height: 8),
        Text('Tỷ giá USD/VND: ${formatRate(snapshot.usdToVnd)}', style: theme.textTheme.bodyMedium),
        Text('Cập nhật lúc ${formatDateTime(snapshot.fetchedAt)}', style: muted),
        const SizedBox(height: 8),
        for (final price in snapshot.prices) _WorldPriceTile(price: price),
        const SizedBox(height: 16),
        Text('Nguồn: gold-api.com, open.er-api.com', style: muted),
      ],
    );
  }
}

class _WorldPriceTile extends StatelessWidget {
  const _WorldPriceTile({required this.price});

  final WorldPrice price;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final vnd = formatVnd(price.vndPerLuong);
    final usd = formatUsd(price.usdPerOunce);

    return Card(
      child: Semantics(
        label: '${price.displayName}: $usd một ounce, quy đổi $vnd một lượng',
        excludeSemantics: true,
        child: ListTile(
          leading: CircleAvatar(
            backgroundColor: theme.colorScheme.primaryContainer,
            child: Icon(Icons.monetization_on, color: theme.colorScheme.onPrimaryContainer),
          ),
          title: Text(price.displayName, style: const TextStyle(fontWeight: FontWeight.bold)),
          subtitle: Text('$usd / ounce'),
          trailing: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(vnd, style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
              Text('/ lượng', style: theme.textTheme.bodySmall),
            ],
          ),
        ),
      ),
    );
  }
}

/// Cho phép kéo để làm mới cả khi nội dung chỉ là một thông báo.
class _ScrollableCenter extends StatelessWidget {
  const _ScrollableCenter({required this.child});

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
