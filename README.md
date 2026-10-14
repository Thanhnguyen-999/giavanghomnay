# Giá Vàng Hôm Nay

Hệ thống theo dõi giá vàng Việt Nam: app mobile, website, trang quản trị và API trên Cloudflare.
Kiến trúc chi tiết: [`ai_docs/architecture.md`](ai_docs/architecture.md).

## Cấu trúc

| Thư mục | Nội dung | Trạng thái |
|---|---|---|
| `apps/mobile` | Flutter (Android/iOS) | Phase 0 xong: khung 4 tab, tab Thế giới chạy được |
| `apps/web` | Astro (tĩnh) → GitHub Pages `https://thanhnguyen-999.github.io/` | Phase 3 |
| `apps/admin` | React + Vite → Cloudflare Workers + Access | Phase 2 |
| `services/api` | Worker `gold-api` (API, crawler, cảnh báo) | D1 + API đọc đã chạy local; crawler/cảnh báo ở Phase 1 |
| `packages/shared`, `packages/extractor` | Schema dùng chung, engine trích xuất giá | Phase 1 |

## Yêu cầu

- Flutter 3.38+ (stable)
- Node 22 LTS (`.nvmrc`) và pnpm (bật bằng `corepack enable`) cho phần TypeScript
- Android Studio/emulator để chạy Android; Xcode (macOS) để chạy iOS

## Chạy app mobile

```bash
cd apps/mobile
flutter pub get
flutter run
```

Hoặc từ thư mục gốc: `npm run mobile:run`. Kiểm tra: `npm run mobile:analyze`, `npm run mobile:test`.

Tùy chọn khi build:

```bash
flutter run --dart-define=GOLD_API_KEY=<key goldapi.io>             # giá XAU theo VND từ GoldAPI
flutter run --dart-define=API_BASE_URL=https://gold-api.<account>.workers.dev   # khi backend sẵn sàng
```

## Dữ liệu hiện tại

Tab **Thế giới** lấy giá XAU/XAG từ [gold-api.com](https://gold-api.com) và tỷ giá từ [open.er-api.com](https://open.er-api.com), quy đổi ra VND/lượng (37,5 g).
Đây là **giá thế giới quy đổi, không phải giá vàng trong nước** (SJC, DOJI, PNJ...). Giá trong nước sẽ có khi backend thu thập giá hoạt động (Phase 1).

Mọi giá trong app chỉ mang tính tham khảo.
