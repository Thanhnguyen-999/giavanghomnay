# Phase 3 — Nối client vào API (mobile + web)

> Dựa trên `architecture.md` mục 12–13 và backend Phase 1–2.
> Hướng đã chốt: **nối cả mobile + web vào API**; tab "Trong nước" tạm rỗng cho tới khi
> admin cấu hình nguồn trong nước thật (Phase 2 đã sẵn sàng nhận). Thứ tự: **mobile trước, web sau**.

---

## 0. Hiện trạng

- Backend: API đọc `/v1/*` (brands, products, prices/latest, prices/:id/history, world/latest)
  + admin `/admin/v1/*`. Chạy local qua `wrangler dev` (127.0.0.1:8787).
- Mobile: 4 tab, chỉ tab **Thế giới** gọi trực tiếp nguồn công khai (gold-api, er-api).
  Tab Trong nước/Biểu đồ là placeholder.
- Web: **chưa có** (`apps/web`).
- Chưa có nguồn giá trong nước thật → `/v1/prices/latest` trả rỗng cho tới khi admin thêm nguồn.

---

## 1. Phạm vi Phase 3

**Mobile (`apps/mobile`):**
1. `ApiClient` (dio) trỏ `API_BASE_URL`; đọc `/v1/*`.
2. Tab **Trong nước**: `/v1/prices/latest` nhóm theo thương hiệu; tăng/giảm so với prev; pull-to-refresh;
   polling 60s khi foreground; ETag/304; cache offline (hiển thị dữ liệu cũ + "cập nhật lúc").
   Khi chưa có nguồn → empty state "đang cập nhật", kèm nút xem Thế giới.
3. Tab **Thế giới**: chuyển sang đọc `/v1/world/latest` của backend **khi có `API_BASE_URL`**;
   không có thì giữ nguồn công khai trực tiếp như hiện tại (fallback, chạy được khi backend chưa deploy).
4. Tab **Biểu đồ**: chọn sản phẩm + khung 1d–1y, vẽ `fl_chart` từ `/v1/prices/:id/history`.
5. Giữ "giá tham khảo", nguồn, nhãn tăng/giảm có màu + mũi tên + dấu.

**Web (`apps/web`, Astro static → GitHub Pages):**
1. Trang chủ: bảng giá trong nước + thế giới (sinh HTML lúc build cho SEO; JS cập nhật giá mới).
2. Trang thương hiệu `/gia-vang/[brand]`, chi tiết + biểu đồ `/gia-vang/[brand]/[product]`.
3. `/gia-vang-the-gioi`. Trang chính sách/điều khoản (tĩnh).
4. SEO: title/meta theo trang, canonical, sitemap từ `/v1/products`, slug do admin đặt.
5. Build-time fetch API; workflow GitHub Actions build + deploy Pages; rebuild theo lịch + repository_dispatch.
6. A11y: bảng `<table>` có caption/scope; tăng/giảm có chữ + icon; điều hướng bàn phím.

**Chưa làm (Phase sau):**
- Đăng nhập người dùng, yêu thích, cảnh báo (Phase 4).
- Realtime WebSocket (chỉ khi cần).
- Nguồn trong nước thật: cấu hình qua admin, không thuộc code Phase 3.

---

## 2. Hợp đồng API dùng chung

Response: `{ data, meta }`. Các endpoint client dùng:

- `GET /v1/brands` → `[{ id, slug, name, logo_r2_key, sort_order }]`
- `GET /v1/products?brand=` → `[{ id, brand_id, slug, name, kind, purity, region, sort_order }]`
- `GET /v1/prices/latest` → `{ data: [{ product_id, brand_id, name, kind, region, buy, sell, prev_buy, prev_sell, changed_at, checked_at, source_id }], meta: { updated_at, count } }` + `ETag`
- `GET /v1/prices/:id/history?range=1d|1w|1m|3m|6m|1y` → tick `[{ recorded_at, buy, sell }]` hoặc daily `[{ day, open_sell, high_sell, low_sell, close_sell, close_buy }]` + `meta.granularity`
- `GET /v1/world/latest` → `[{ symbol, price_usd, usd_vnd, recorded_at }]`

Mobile build-time cấu hình: `--dart-define=API_BASE_URL=...`. Nếu rỗng → tab Trong nước/Biểu đồ hiện "cần cấu hình máy chủ", tab Thế giới dùng nguồn trực tiếp (như hiện nay).

---

## 3. Mobile — thay đổi cụ thể

```
lib/
├── core/network/
│   ├── api_client.dart       # dio GET /v1/*, gắn ETag, User-Agent; map lỗi ApiException
│   └── (dio_provider, api_exception, retry_policy đã có)
├── core/cache/
│   └── snapshot_cache.dart   # shared_preferences: lưu JSON latest + etag
├── features/prices/          # TRONG NƯỚC (mới)
│   ├── data/{domestic_price.dart, price_repository.dart}
│   └── presentation/{prices_page.dart (viết lại), providers.dart, widgets/}
├── features/world/           # trỏ API khi có API_BASE_URL, fallback nguồn trực tiếp
├── features/chart/
│   ├── data/{history_point.dart, history_repository.dart}
│   └── presentation/{chart_page.dart (viết lại), providers.dart}
└── core/format/ (đã có)
```

- `PriceRepository.watchLatest()`: phát cache trước → gọi API (ETag) → cập nhật; lỗi mà có cache thì giữ cache + cờ offline. (Mẫu đã mô tả ở architecture 13.3.)
- Polling 60s bằng Riverpod (timer dừng khi app background — dùng `AppLifecycleListener`).
- `fl_chart`: thêm dependency; line chart, chọn khung thời gian, tooltip.
- Test widget: tab Trong nước có dữ liệu / rỗng / lỗi; chart đổi khung.

---

## 4. Web — `apps/web` (Astro)

```
apps/web/
├── astro.config.mjs        # output: 'static', site + base (GitHub Pages)
├── package.json, tsconfig.json
├── src/
│   ├── lib/api.ts          # fetch API lúc build + client-side refresh
│   ├── layouts/Base.astro  # meta/SEO, header/footer, disclaimer
│   ├── components/         # PriceTable.astro, PriceCell, LivePrices (island), Chart (island)
│   ├── pages/
│   │   ├── index.astro
│   │   ├── gia-vang/[brand].astro        # getStaticPaths từ /v1/brands
│   │   ├── gia-vang/[brand]/[product].astro
│   │   ├── gia-vang-the-gioi.astro
│   │   ├── chinh-sach-bao-mat.astro, dieu-khoan.astro
│   │   └── sitemap/...     # hoặc @astrojs/sitemap
│   └── env.d.ts
└── public/                 # robots.txt, icon
```

- **Build-time:** `PUBLIC_API_BASE_URL` (hoặc build arg) để fetch danh mục + giá, sinh HTML + sitemap.
  Nếu API chưa reachable lúc build → sinh trang khung (brands rỗng) nhưng không fail build.
- **Client-side island:** `LivePrices` fetch `/v1/prices/latest` khi mở trang, cập nhật số; cần CORS
  (đã cho `thanhnguyen-999.github.io` trong `CORS_ORIGINS`).
- **Deploy:** workflow `web.yml` build `apps/web`, đẩy `dist` sang GitHub Pages
  (hoặc repo `Thanhnguyen-999.github.io`). Base path `/giavanghomnay` nếu chưa có repo gốc domain.

---

## 5. CORS & cấu hình

- API `CORS_ORIGINS` đã gồm `https://thanhnguyen-999.github.io`. Thêm `http://localhost:4321`
  (Astro dev) khi phát triển web, qua `.dev.vars`/vars local — không đưa localhost lên production.
- Mobile không cần CORS.

---

## 6. Thứ tự thực hiện

**A. Mobile (trước)**
1. `api_client.dart` + `snapshot_cache.dart` + cấu hình `API_BASE_URL`.
2. Tab Trong nước: repository + providers + UI (list, offline banner, empty state) + polling.
3. Tab Biểu đồ: history repository + fl_chart + chọn khung.
4. Tab Thế giới: đọc `/v1/world/latest` khi có API_BASE_URL (fallback nguồn trực tiếp).
5. Test widget + `flutter analyze` + chạy emulator; cập nhật mobile CI nếu cần.

**B. Web (sau)**
6. Scaffold `apps/web` Astro + layout + api.ts.
7. Trang chủ + brand + product + world + chính sách; SEO + sitemap.
8. `LivePrices`/`Chart` island.
9. `web.yml` build + deploy Pages; verify build tĩnh (không cần API sống).
10. Verify toàn bộ: typecheck/build/test cả hai, pnpm frozen-lockfile.

Mỗi bước tự verify trước khi sang bước sau. Mobile và web độc lập nên có thể dừng sau A để bạn xem.

---

## 7. Rủi ro & lưu ý

| Vấn đề | Xử lý |
|---|---|
| Chưa có giá trong nước | Tab/trang hiển thị empty state "đang cập nhật"; vẫn có giá thế giới. Không chặn Phase 3. |
| Build web khi API offline | api.ts bắt lỗi → sinh trang khung, không fail build; giá do client tải sau. |
| GitHub Pages base path | Dùng `base` trong astro.config; chốt sau khi biết dùng repo gốc domain hay `/giavanghomnay`. |
| fl_chart khung 1y nhiều điểm | Dùng dữ liệu `price_daily` (đã tổng hợp) cho range dài; tick chỉ 1d/1w. |
| Polling tốn pin | Dừng timer khi app background (AppLifecycleListener); 60s + ETag 304 nhẹ. |

---

## 8. Câu cần bạn xác nhận

1. **Thứ tự mobile trước, web sau** — đồng ý? (Có thể dừng sau phần mobile để bạn xem rồi mới làm web.)
2. **Base path web:** bạn sẽ tạo repo `Thanhnguyen-999.github.io` (web ở gốc domain) hay deploy trong repo này (`/giavanghomnay/`)? Nếu chưa chắc, tôi mặc định `/giavanghomnay/` và đổi sau bằng một biến.
3. **API_BASE_URL cho mobile khi dev:** tôi dùng `http://127.0.0.1:8787` để test với wrangler dev; bản phát hành sẽ trỏ `workers.dev` sau khi deploy. OK chứ?
