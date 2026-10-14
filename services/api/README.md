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
pnpm run db:seed:local        # nạp dữ liệu mẫu (chỉ dev)
pnpm run dev                  # http://127.0.0.1:8787
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
pnpm run db:list:remote                 # xác nhận migration đã áp dụng
```

Không nạp `seed/dev.sql` lên production: thương hiệu/sản phẩm thật tạo từ admin dashboard.

## Secret (khi thêm Firebase/FCM ở Phase 1–4)

```bash
npx wrangler secret put FCM_SERVICE_ACCOUNT
```

Local: tạo `services/api/.dev.vars` (xem `.dev.vars.example`), file này đã nằm trong `.gitignore`.
