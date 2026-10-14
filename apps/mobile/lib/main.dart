import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app/app.dart';
import 'core/network/retry_policy.dart';

void main() {
  runApp(const ProviderScope(retry: appRetry, child: GoldPriceApp()));
}
