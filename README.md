# Giá Vàng Hôm Nay

Ứng dụng giờ đã tích hợp API giá vàng thực tế (spot) và tỷ giá USD→VND để hiển thị giá tham khảo bằng VND/1 lượng.

Nguồn dữ liệu (miễn phí, không cần API key):
- Spot metals: https://api.metals.live/v1/spot
- Tỷ giá USD→VND: https://api.exchangerate.host/latest?base=USD&symbols=VND

Lưu ý:
- Các API bên thứ ba có thể thay đổi hoặc giới hạn truy cập; nếu bạn có API key cho dịch vụ khác (ví dụ Metals-API, GoldAPI), mình có thể chuyển sang dùng API đó.
- Kết quả hiển thị là giá tham khảo (quy đổi từ USD/oz → VND/lượng). Bạn có thể tinh chỉnh quy đổi hoặc nguồn dữ liệu nếu cần.

Cách chạy:
1. flutter pub get
2. flutter run

