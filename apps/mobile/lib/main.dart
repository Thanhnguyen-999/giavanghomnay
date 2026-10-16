import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app/app.dart';
import 'core/cache/snapshot_cache.dart';
import 'core/network/retry_policy.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final prefs = await SharedPreferences.getInstance();

  runApp(
    ProviderScope(
      retry: appRetry,
      overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
      child: const GoldPriceApp(),
    ),
  );
}
