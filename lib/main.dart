import 'package:flutter/material.dart';

void main() {
  runApp(const GoldPriceApp());
}

class GoldPriceApp extends StatelessWidget {
  const GoldPriceApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Giá Vàng Hôm Nay',
      theme: ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: const Color(0xFFF8F7F4),
        colorScheme: ColorScheme.fromSeed(
          seedColor: Colors.amber,
          brightness: Brightness.light,
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.transparent,
          foregroundColor: Colors.black87,
          elevation: 0,
        ),
      ),
      home: const GoldHomePage(),
    );
  }
}

class GoldHomePage extends StatefulWidget {
  const GoldHomePage({super.key});

  @override
  State<GoldHomePage> createState() => _GoldHomePageState();
}

class _GoldHomePageState extends State<GoldHomePage> {
  final List<GoldItem> _items = [
    GoldItem(id: 1, name: 'SJC', buy: 79200, sell: 79900, trend: 0.35, unit: 'lượng'),
    GoldItem(id: 2, name: '24K', buy: 78100, sell: 79000, trend: 0.2, unit: 'lượng'),
    GoldItem(id: 3, name: '14K', buy: 67200, sell: 68150, trend: 0.42, unit: 'lượng'),
    GoldItem(id: 4, name: 'Nhẫn tròn', buy: 74500, sell: 75200, trend: 0.18, unit: 'chỉ'),
    GoldItem(id: 5, name: 'Vàng miếng', buy: 81500, sell: 82300, trend: 0.4, unit: 'miếng'),
    GoldItem(id: 6, name: 'Vàng nữ trang', buy: 77500, sell: 78350, trend: 0.28, unit: 'lượng'),
  ];

  final Set<int> _favoriteIds = {1, 5};
  int _selectedIndex = 0;

  void _toggleFavorite(int id) {
    setState(() {
      if (_favoriteIds.contains(id)) {
        _favoriteIds.remove(id);
      } else {
        _favoriteIds.add(id);
      }
    });
  }

  List<GoldItem> get _favoriteItems =>
      _items.where((item) => _favoriteIds.contains(item.id)).toList();

  @override
  Widget build(BuildContext context) {
    final Widget body = switch (_selectedIndex) {
      0 => _buildOverviewTab(),
      1 => _buildPriceTab(),
      2 => _buildFavoriteTab(),
      _ => _buildOverviewTab(),
    };

    return Scaffold(
      appBar: AppBar(
        title: const Text('Giá Vàng Hôm Nay'),
        actions: [
          IconButton(
            onPressed: () {},
            icon: const Icon(Icons.notifications_none_rounded),
          ),
        ],
      ),
      body: body,
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _selectedIndex,
        onTap: (index) => setState(() => _selectedIndex = index),
        selectedItemColor: Colors.amber.shade800,
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.home_rounded),
            label: 'Tổng quan',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.price_change_rounded),
            label: 'Giá',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.favorite_rounded),
            label: 'Yêu thích',
          ),
        ],
      ),
    );
  }

  Widget _buildOverviewTab() {
    final firstItem = _items.first;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFFFFD54F), Color(0xFFFFB300)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(24),
              boxShadow: [
                BoxShadow(
                  color: Colors.amber.withOpacity(0.25),
                  blurRadius: 14,
                  offset: const Offset(0, 10),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Giá vàng hôm nay',
                      style: TextStyle(
                        color: Colors.black87,
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.35),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      const Text(
                        'Live',
                        style: TextStyle(
                          color: Colors.black87,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Text(
                  '${firstItem.buy.toString().replaceAllMapped(RegExp(r'(.)(?=(.*\d{3})+(?!\d))'), (match) => '${match[1]}.')} VND',
                  style: const TextStyle(
                    fontSize: 30,
                    fontWeight: FontWeight.bold,
                    color: Colors.black,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Cập nhật lúc ${DateTime.now().hour}:${DateTime.now().minute.toString().padLeft(2, '0')}',
                  style: const TextStyle(
                    color: Colors.black54,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          const Text(
            'Tổng quan thị trường',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _MarketStatCard(
                  title: 'Mua vào',
                  value: '79.200',
                  color: Colors.green,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _MarketStatCard(
                  title: 'Bán ra',
                  value: '79.900',
                  color: Colors.orange,
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          const Text(
            'Xu hướng',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 120,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                _TrendCard(label: 'SJC', value: '+0.35%', color: Colors.green),
                _TrendCard(label: '24K', value: '+0.20%', color: Colors.orange),
                _TrendCard(label: '14K', value: '+0.42%', color: Colors.red),
                _TrendCard(label: 'Nhẫn', value: '+0.18%', color: Colors.blue),
              ],
            ),
          ),
          const SizedBox(height: 24),
          const Text(
            'Theo dõi nhanh',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 12),
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: _items.take(3).length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (context, index) {
              final item = _items[index];
              final isFavorite = _favoriteIds.contains(item.id);

              return Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 42,
                      height: 42,
                      decoration: BoxDecoration(
                        color: Colors.amber.shade100,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.currency_bitcoin_rounded, color: Colors.amber),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(item.name, style: const TextStyle(fontWeight: FontWeight.bold)),
                          Text(
                            'Mua ${item.buy} • Bán ${item.sell}',
                            style: const TextStyle(fontSize: 12, color: Colors.black54),
                          ),
                        ],
                      ),
                    ),
                    GestureDetector(
                      onTap: () => _toggleFavorite(item.id),
                      child: Icon(
                        isFavorite ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                        color: isFavorite ? Colors.red : Colors.grey,
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildPriceTab() {
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _items.length,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final item = _items[index];
        final isFavorite = _favoriteIds.contains(item.id);

        return Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(18),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.03),
                blurRadius: 10,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: Row(
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: Colors.amber.shade50,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Icon(Icons.monetization_on_rounded, color: Colors.amber),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.name,
                      style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Mua ${item.buy.toString()} • Bán ${item.sell.toString()}',
                      style: const TextStyle(fontSize: 12, color: Colors.black54),
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    '${item.trend > 0 ? '+' : ''}${item.trend.toStringAsFixed(2)}%',
                    style: TextStyle(
                      color: item.trend >= 0 ? Colors.green : Colors.red,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 8),
                  IconButton(
                    visualDensity: VisualDensity.compact,
                    onPressed: () => _toggleFavorite(item.id),
                    icon: Icon(
                      isFavorite ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                      color: isFavorite ? Colors.red : Colors.grey,
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildFavoriteTab() {
    if (_favoriteItems.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: const [
            Icon(Icons.favorite_border_rounded, size: 52, color: Colors.grey),
            SizedBox(height: 14),
            Text('Chưa có mặt hàng yêu thích nào'),
          ],
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _favoriteItems.length,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final item = _favoriteItems[index];
        return Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(18),
          ),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: Colors.amber.shade100,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.star_rounded, color: Colors.amber),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(item.name, style: const TextStyle(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 4),
                    Text(
                      'Mua ${item.buy} • Bán ${item.sell}',
                      style: const TextStyle(fontSize: 12, color: Colors.black54),
                    ),
                  ],
                ),
              ),
              IconButton(
                onPressed: () => _toggleFavorite(item.id),
                icon: const Icon(Icons.remove_circle_outline_rounded, color: Colors.red),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _MarketStatCard extends StatelessWidget {
  final String title;
  final String value;
  final Color color;

  const _MarketStatCard({
    required this.title,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontSize: 12, color: Colors.black54)),
          const SizedBox(height: 8),
          Text(
            value,
            style: TextStyle(
              color: color,
              fontSize: 22,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }
}

class _TrendCard extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _TrendCard({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 120,
      margin: const EdgeInsets.only(right: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  color: color,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
              const SizedBox(width: 8),
              Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
            ],
          ),
          const Spacer(),
          Text(
            value,
            style: TextStyle(
              color: color,
              fontWeight: FontWeight.bold,
              fontSize: 17,
            ),
          ),
          const SizedBox(height: 12),
          Container(
            height: 28,
            width: double.infinity,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [color.withOpacity(0.25), color.withOpacity(0.05)],
                begin: Alignment.bottomCenter,
                end: Alignment.topCenter,
              ),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Align(
              alignment: Alignment.bottomCenter,
              child: Icon(Icons.trending_up_rounded, size: 18, color: Colors.black54),
            ),
          ),
        ],
      ),
    );
  }
}

class GoldItem {
  final int id;
  final String name;
  final int buy;
  final int sell;
  final double trend;
  final String unit;

  GoldItem({
    required this.id,
    required this.name,
    required this.buy,
    required this.sell,
    required this.trend,
    required this.unit,
  });
}
