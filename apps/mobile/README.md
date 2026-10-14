# apps/mobile — Giá Vàng Hôm Nay (Flutter)

App Android/iOS. Kiến trúc: `../../ai_docs/architecture.md` (mục 13).

## Chạy

```bash
flutter pub get
flutter run                                   # thiết bị/emulator đang kết nối
flutter run --dart-define=API_BASE_URL=https://gold-api.<account>.workers.dev
```

`API_BASE_URL` chưa dùng ở Phase 0 (backend chưa có). Tab "Thế giới" gọi trực tiếp nguồn công khai.

## Kiểm tra

```bash
flutter analyze
flutter test
```

## Cấu trúc `lib/`

```
lib/
├── main.dart              # ProviderScope + App
├── app/                   # app.dart, theme.dart, home_shell.dart (bottom nav)
├── core/                  # config, network, format
├── features/
│   ├── prices/            # giá trong nước (chờ backend)
│   ├── world/             # giá thế giới quy đổi
│   ├── chart/             # biểu đồ (chờ backend)
│   └── account/           # tài khoản & cài đặt
└── shared/widgets/
```
