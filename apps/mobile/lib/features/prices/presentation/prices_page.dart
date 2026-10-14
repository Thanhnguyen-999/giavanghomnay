import 'package:flutter/material.dart';

import '../../../shared/widgets/message_view.dart';

/// Bảng giá vàng trong nước. Chờ backend (Phase 1) cung cấp `/v1/prices/latest`.
class PricesPage extends StatelessWidget {
  const PricesPage({super.key, this.onOpenWorld});

  final VoidCallback? onOpenWorld;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Giá Vàng Hôm Nay')),
      body: MessageView(
        icon: Icons.storefront_outlined,
        title: 'Giá vàng trong nước sắp có',
        message:
            'Bảng giá các thương hiệu (SJC, DOJI, PNJ...) sẽ hiển thị khi hệ thống '
            'thu thập giá hoạt động. Trong lúc chờ, bạn có thể xem giá thế giới.',
        actionLabel: onOpenWorld == null ? null : 'Xem giá thế giới',
        onAction: onOpenWorld,
      ),
    );
  }
}
