# apps/admin — Trang quản trị (React + Vite)

SPA quản trị cho `gold-api`. Kiến trúc: `../../ai_docs/architecture.md` mục 7, `phase2-admin.md`.

## Dev

Cần Worker API chạy song song (dev-mode):

```bash
# Terminal 1 — API
cd services/api && pnpm run dev        # http://127.0.0.1:8787 (ENVIRONMENT=dev qua .dev.vars)

# Terminal 2 — admin UI
cd apps/admin && pnpm run dev          # http://127.0.0.1:5173
```

Vite proxy chuyển `/admin/v1` và `/v1` sang Worker, tự gắn header `X-Dev-Email: dev@local`.
Thêm admin đó vào D1 local trước (xem `services/api/README.md`).

## Build & deploy

```bash
pnpm run build      # ra dist/
pnpm run deploy     # wrangler deploy (static assets)
```

Production: đặt hostname `gold-admin.<account>.workers.dev` sau Cloudflare Access.
UI gọi API cùng miền qua cookie Access; không nhúng secret.

## Phân quyền

UI ẩn/hiện chức năng theo `role` lấy từ `GET /admin/v1/me` (viewer < editor < owner).
Phân quyền thật nằm ở server; UI chỉ hỗ trợ trải nghiệm.
