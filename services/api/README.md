# services/api — Worker `gold-api`

API + crawler + cảnh báo trên Cloudflare Workers. Kiến trúc: `../../ai_docs/architecture.md`.

Trạng thái: khởi tạo D1 + API đọc công khai (`/health`, `/v1/brands`, `/v1/products`, `/v1/prices/latest`).
Crawler, KV snapshot, Queues, cảnh báo, admin: Phase 1–2.

## Cài đặt

Chạy ở thư mục gốc monorepo: `pnpm install` (bật pnpm bằng `corepack enable`, hoặc dùng `npx pnpm@12.11.2`).

## Dev local (không cần tài khoản Cloudflare)

```bash
cd services/api
pnpm run db:migrate:local     # tạo D1 SQLite trong .wrangler/state (gitignored)
pnpm run db:sources:local     # nạp nguồn world + fx (cấu hình vận hành)
pnpm run db:seed:local        # (tùy chọn) dữ liệu giá trong nước giả để test UI
pnpm run dev                  # http://127.0.0.1:8787

# Chạy một vòng crawl (cron không tự chạy ở local):
curl "http://127.0.0.1:8787/cdn-cgi/local/scheduled"
```

Kiểm tra:

```bash
curl http://127.0.0.1:8787/health
curl http://127.0.0.1:8787/v1/prices/latest
```

## Tạo D1 thật trên Cloudflare

```bash
npx wrangler login                      # mở trình duyệt, đăng nhập tài khoản của bạn
npx wrangler d1 create gold-db          # in ra database_id
# → dán database_id vào wrangler.toml ([[d1_databases]].database_id)
pnpm run db:migrate:remote              # tạo bảng trên production
pnpm run db:sources:remote              # nạp nguồn world + fx lên production
pnpm run db:list:remote                 # xác nhận migration đã áp dụng
```

Không nạp `seed/dev.sql` lên production (đó là giá trong nước giả): thương hiệu/sản phẩm thật tạo từ admin dashboard.

## Tạo KV + Queue thật (khi deploy)

```bash
npx wrangler kv namespace create CACHE      # in ra id → dán vào wrangler.toml [[kv_namespaces]].id
npx wrangler queues create crawl-jobs
npx wrangler queues create crawl-jobs-dlq
```

Local dev (`wrangler dev`) tự tạo KV/Queue local trong `.wrangler/state`, không cần id thật.
Cron không tự chạy ở local; trigger thủ công bằng:

```bash
curl "http://127.0.0.1:8787/cdn-cgi/local/scheduled"
```

## Secret (khi thêm Firebase/FCM ở Phase 1–4)

```bash
npx wrangler secret put FCM_SERVICE_ACCOUNT
```

Local: tạo `services/api/.dev.vars` (xem `.dev.vars.example`), file này đã nằm trong `.gitignore`.
