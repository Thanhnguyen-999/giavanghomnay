import 'package:flutter/material.dart';

import '../features/account/presentation/account_page.dart';
import '../features/chart/presentation/chart_page.dart';
import '../features/prices/presentation/prices_page.dart';
import '../features/world/presentation/world_page.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  static const domesticTab = 0;
  static const worldTab = 1;

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  // Mở tab Thế giới trước vì giá trong nước chưa có dữ liệu.
  // Đổi về HomeShell.domesticTab khi backend chạy (Phase 3).
  int _index = HomeShell.worldTab;

  void _select(int index) => setState(() => _index = index);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _index,
        children: [
          PricesPage(onOpenWorld: () => _select(HomeShell.worldTab)),
          const WorldPage(),
          const ChartPage(),
          const AccountPage(),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: _select,
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.storefront_outlined),
            selectedIcon: Icon(Icons.storefront),
            label: 'Trong nước',
          ),
          NavigationDestination(
            icon: Icon(Icons.public_outlined),
            selectedIcon: Icon(Icons.public),
            label: 'Thế giới',
          ),
          NavigationDestination(icon: Icon(Icons.show_chart), label: 'Biểu đồ'),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person),
            label: 'Tài khoản',
          ),
        ],
      ),
    );
  }
}
