import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/format/formatters.dart';
import '../../../shared/widgets/message_view.dart';
import '../../prices/presentation/price_providers.dart';
import '../data/history.dart';
import 'chart_providers.dart';

class ChartPage extends ConsumerWidget {
  const ChartPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final hasBackend = ref.watch(hasBackendProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Biểu đồ')),
      body: hasBackend
          ? const _ChartBody()
          : const MessageView(
              icon: Icons.show_chart,
              title: 'Biểu đồ cần máy chủ',
              message: 'Bản dựng này chưa cấu hình máy chủ để lấy lịch sử giá.',
            ),
    );
  }
}

class _ChartBody extends ConsumerWidget {
  const _ChartBody();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final products = ref.watch(productsProvider);
    final sel = ref.watch(chartSelectionProvider);

    return products.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => MessageView(
        icon: Icons.error_outline,
        title: 'Không tải được danh sách sản phẩm',
        message: '$e',
      ),
      data: (list) {
        if (list.isEmpty) {
          return const MessageView(
            icon: Icons.hourglass_empty,
            title: 'Chưa có sản phẩm',
            message: 'Khi quản trị viên thêm sản phẩm và giá, biểu đồ sẽ hiển thị ở đây.',
          );
        }
        // Tự chọn sản phẩm đầu tiên nếu chưa chọn.
        final current = sel.productId ?? list.first.id;
        if (sel.productId == null) {
          WidgetsBinding.instance.addPostFrameCallback(
            (_) => ref.read(chartSelectionProvider.notifier).selectProduct(current),
          );
        }

        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            DropdownButtonFormField<String>(
              initialValue: current,
              decoration: const InputDecoration(labelText: 'Sản phẩm'),
              items: [for (final p in list) DropdownMenuItem(value: p.id, child: Text(p.name))],
              onChanged: (v) {
                if (v != null) ref.read(chartSelectionProvider.notifier).selectProduct(v);
              },
            ),
            const SizedBox(height: 12),
            _RangeSelector(selected: sel.range),
            const SizedBox(height: 16),
            const _ChartArea(),
          ],
        );
      },
    );
  }
}

class _RangeSelector extends ConsumerWidget {
  const _RangeSelector({required this.selected});
  final ChartRange selected;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Wrap(
      spacing: 8,
      children: [
        for (final r in ChartRange.values)
          ChoiceChip(
            label: Text(r.label),
            selected: r == selected,
            onSelected: (_) => ref.read(chartSelectionProvider.notifier).selectRange(r),
          ),
      ],
    );
  }
}

class _ChartArea extends ConsumerWidget {
  const _ChartArea();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final series = ref.watch(historySeriesProvider);

    return series.when(
      loading: () => const SizedBox(height: 260, child: Center(child: CircularProgressIndicator())),
      error: (e, _) => SizedBox(
        height: 260,
        child: MessageView(
          icon: Icons.error_outline,
          title: 'Không tải được biểu đồ',
          message: '$e',
        ),
      ),
      data: (s) {
        if (s.points.length < 2) {
          return const SizedBox(
            height: 260,
            child: MessageView(
              icon: Icons.timeline,
              title: 'Chưa đủ dữ liệu',
              message: 'Cần ít nhất 2 điểm giá để vẽ biểu đồ. Hãy quay lại sau.',
            ),
          );
        }
        return SizedBox(height: 300, child: _LineChart(series: s));
      },
    );
  }
}

class _LineChart extends StatelessWidget {
  const _LineChart({required this.series});
  final HistorySeries series;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final pts = series.points;
    final spots = [
      for (var i = 0; i < pts.length; i++) FlSpot(i.toDouble(), pts[i].sell.toDouble()),
    ];
    final minY = pts.map((p) => p.sell).reduce((a, b) => a < b ? a : b).toDouble();
    final maxY = pts.map((p) => p.sell).reduce((a, b) => a > b ? a : b).toDouble();
    final pad = (maxY - minY) * 0.1 + 1;

    return LineChart(
      LineChartData(
        minY: minY - pad,
        maxY: maxY + pad,
        gridData: const FlGridData(show: true, drawVerticalLine: false),
        titlesData: FlTitlesData(
          topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          bottomTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          leftTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 56,
              getTitlesWidget: (value, meta) =>
                  Text(_compact(value), style: theme.textTheme.bodySmall),
            ),
          ),
        ),
        borderData: FlBorderData(show: false),
        lineTouchData: LineTouchData(
          touchTooltipData: LineTouchTooltipData(
            getTooltipItems: (spots) => spots.map((s) {
              final p = pts[s.x.toInt()];
              return LineTooltipItem(
                '${formatVnd(p.sell)}\n${_label(p.at)}',
                TextStyle(color: theme.colorScheme.onInverseSurface, fontSize: 12),
              );
            }).toList(),
          ),
        ),
        lineBarsData: [
          LineChartBarData(
            spots: spots,
            isCurved: false,
            color: theme.colorScheme.primary,
            barWidth: 2,
            dotData: const FlDotData(show: false),
            belowBarData: BarAreaData(
              show: true,
              color: theme.colorScheme.primary.withValues(alpha: 0.12),
            ),
          ),
        ],
      ),
    );
  }

  static String _compact(double v) {
    if (v >= 1e6) return '${(v / 1e6).toStringAsFixed(1)}tr';
    if (v >= 1e3) return '${(v / 1e3).toStringAsFixed(0)}k';
    return v.toStringAsFixed(0);
  }

  static String _label(int unixSec) {
    final d = DateTime.fromMillisecondsSinceEpoch(unixSec * 1000).toLocal();
    return '${d.day}/${d.month}';
  }
}
