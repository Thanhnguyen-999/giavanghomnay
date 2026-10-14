import 'package:flutter/material.dart';

/// Tài khoản & cài đặt. Đăng nhập (Firebase Auth) thuộc Phase 4.
class AccountPage extends StatelessWidget {
  const AccountPage({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Tài khoản')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Bạn đang xem ở chế độ khách', style: theme.textTheme.titleMedium),
                  const SizedBox(height: 8),
                  const Text(
                    'Đăng nhập để dùng cảnh báo giá, đồng bộ yêu thích giữa các thiết bị '
                    'và sổ vàng.',
                  ),
                  const SizedBox(height: 16),
                  const FilledButton(onPressed: null, child: Text('Đăng nhập (sắp có)')),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          const ListTile(
            leading: Icon(Icons.info_outline),
            title: Text('Giá chỉ mang tính tham khảo'),
            subtitle: Text('Vui lòng kiểm tra lại với cửa hàng trước khi giao dịch.'),
          ),
        ],
      ),
    );
  }
}
