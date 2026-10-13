# Giá Vàng Hôm Nay

Một ứng dụng Flutter mẫu hiển thị giá vàng hôm nay với giao diện đơn giản, dễ nhìn và thân thiện với người dùng.

## Tính năng

- Hiển thị giá mua, bán và các loại vàng phổ biến
- Giao diện theo kiểu card, dễ đọc
- Chạy trên Android và iOS
- Sẵn sàng phát triển thêm chức năng cập nhật giá thời gian thực

## Cài đặt

1. Cài đặt Flutter SDK: https://flutter.dev/docs/get-started/install
2. Clone repo:
   ```bash
   git clone https://github.com/Thanhnguyen-999/giavanghomnay.git
   cd giavanghomnay
   ```
3. Cài đặt dependencies:
   ```bash
   flutter pub get
   ```
4. Chạy ứng dụng:
   ```bash
   flutter run
   ```

## Giao diện mẫu

- Top bar với tiêu đề "Giá Vàng Hôm Nay"
- Thẻ hiển thị giá SJC, 24K, nhẫn tròn, vàng miếng
- Cột biểu đồ/biến động giá với màu sắc dễ nhận biết

## Tệp chính

- `lib/main.dart`: giao diện và logic chính
