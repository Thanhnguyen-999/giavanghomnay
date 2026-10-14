import 'package:intl/intl.dart';

final _vnd = NumberFormat.decimalPattern('vi');
final _usd = NumberFormat.currency(locale: 'en_US', symbol: r'$', decimalDigits: 2);
final _rate = NumberFormat.decimalPattern('vi')..maximumFractionDigits = 2;
final _dateTime = DateFormat('HH:mm dd/MM/yyyy');

/// 120500000 → "120.500.000 đ"
String formatVnd(num value) => '${_vnd.format(value.round())} đ';

/// 4189.9 → "$4,189.90"
String formatUsd(num value) => _usd.format(value);

/// 25897.06 → "25.897,06"
String formatRate(num value) => _rate.format(value);

/// Hiển thị theo giờ máy.
String formatDateTime(DateTime value) => _dateTime.format(value.toLocal());
