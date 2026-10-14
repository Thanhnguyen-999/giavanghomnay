import 'package:flutter/material.dart';

import '../../../shared/widgets/message_view.dart';

/// Biểu đồ lịch sử giá. Chờ backend có `/v1/prices/{productId}/history`.
class ChartPage extends StatelessWidget {
  const ChartPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Biểu đồ')),
      body: const MessageView(
        icon: Icons.show_chart,
        title: 'Biểu đồ sắp có',
        message: 'Biểu đồ 1 ngày đến 1 năm cần dữ liệu lịch sử từ hệ thống thu thập giá.',
      ),
    );
  }
}
