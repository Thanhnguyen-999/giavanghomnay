# Giá Vàng Hôm Nay

Ứng dụng Flutter theo dõi giá vàng và hỗ trợ kết nối với nguồn dữ liệu thời gian thực.

## Lưu ý quan trọng về API giá vàng Việt Nam

Hiện nay, không có một API chính thức và miễn phí nào công khai cung cấp giá Vàng SJC / giá vàng Việt Nam thực tế theo chuẩn thị trường Việt Nam với độ chính xác cao như dữ liệu mua bán tại các công ty kinh doanh vàng lớn.

Vì vậy, ứng dụng hiện đang hỗ trợ 2 phương án:

1. Nếu bạn có API key từ nhà cung cấp giá vàng quốc tế (ví dụ GoldAPI), bạn có thể dùng trực tiếp bằng biến môi trường:
   ```bash
   flutter run --dart-define=GOLD_API_KEY=YOUR_KEY_HERE
   ```
2. Nếu không có API key, ứng dụng sẽ tự động dùng nguồn dữ liệu public tự do để hiển thị giá tham khảo dưới dạng VND/lượng.

## Tính năng

- Tổng quan giá vàng hôm nay
- Hiển thị giá mua, bán cho các loại vàng phổ biến
- Màn hình yêu thích
- Cập nhật dữ liệu thời gian thực khi có API key hợp lệ
- Dễ mở rộng cho tương lai: lịch sử giá, cảnh báo, chi tiết loại vàng

## Cách chạy

```bash
git clone https://github.com/Thanhnguyen-999/giavanghomnay.git
cd giavanghomnay
flutter pub get
flutter run
```

Nếu có API key:

```bash
flutter run --dart-define=GOLD_API_KEY=YOUR_KEY_HERE
```

## Nguồn dữ liệu hiện tại

- GoldAPI (khi có key)
- Metals.live + exchangerate.host (fallback miễn phí)

## Mục tiêu

Phù hợp cho demo và MVP. Nếu bạn cần đúng chuẩn giá SJC / giá vàng Việt Nam chuyên dụng, nên ký hợp đồng với nhà cung cấp dữ liệu hoặc dùng thêm scraper từ các nguồn chính thức.

