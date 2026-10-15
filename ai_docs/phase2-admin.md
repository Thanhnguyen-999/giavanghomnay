# Phase 2 — Admin dashboard (kế hoạch chi tiết)

> Dựa trên `architecture.md` mục 7–9 và nền Phase 1 (`phase1-backend.md`).
> Mục tiêu: admin tự thêm/sửa thương hiệu, sản phẩm, nguồn (cấu hình động), map nhãn,
> duyệt giá bất thường — **không cần sửa code**. Xác thực bằng Cloudflare Access.

---

## 0. Hiện trạng (đầu Phase 2)

- Backend Phase 1 xong: D1 18 bảng, vòng crawl world+fx, API đọc công khai `/v1/*`.
- Bảng quản trị đã có sẵn trong schema: `brands`, `products`, `sources`, `source_configs`,
  `source_mappings`, `price_reviews`, `crawl_runs`, `admins`, `audit_log`.
- Chưa có: route `/admin/v1/*`, xác thực Access, SPA admin, nút "Chạy thử".

---

## 1. Phạm vi Phase 2

**Có:**
1. Xác thực admin: Cloudflare Access JWT + bảng `admins` (role owner/editor/viewer).
2. API `/admin/v1/*` trong Worker `gold-api`: CRUD danh mục, quản lý nguồn + version cấu hình,
   dry-run, chạy ngay, mapping, kiểm duyệt giá, nhập giá tay, nhật ký, audit.
3. `apps/admin`: React + Vite SPA, deploy lên Workers static assets, đặt sau Access.
4. Khi admin sửa danh mục/giá → ghi lại KV snapshot để app/web thấy ngay.
5. Audit log cho mọi thao tác ghi.
6. Test cho auth, phân quyền, dry-run, kiểm duyệt.

**Chưa có (Phase sau):**
- Đăng nhập người dùng cuối + `/v1/me/*` (Phase 4).
- Nối app mobile/web vào API (Phase 3).
- Upload logo R2: Phase 2 chấp nhận URL logo; R2 để sau nếu cần.

---

## 2. Xác thực bằng Cloudflare Access

### 2.1 Bạn cấu hình trên dashboard (một lần)

1. **Zero Trust** → bật (gói free tới 50 user). Chọn team domain, vd `thanhnguyen999.cloudflareaccess.com`.
2. **Access → Applications → Add → Self-hosted**:
   - Application domain: hostname admin (`gold-admin.<account>.workers.dev`) **và** path API admin
     (có thể thêm `gold-api.<account>.workers.dev/admin` làm application thứ hai).
   - Policy: Allow, theo email cụ thể của bạn (và các admin khác).
3. Lấy hai giá trị để Worker verify token:
   - **Team domain** (issuer): `https://<team>.cloudflareaccess.com`
   - **Application Audience (AUD) tag**: chuỗi hash trong tab Overview của application.

Hai giá trị này là **biến không bí mật**, đặt trong `wrangler.toml [vars]`:
`ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`.

### 2.2 Worker verify (đã phác trong architecture mục 8.2)

- Middleware `requireAdmin(minRole)` đọc header `Cf-Access-Jwt-Assertion`, verify bằng `jose`
  với JWKS tại `${teamDomain}/cdn-cgi/access/certs`, kiểm issuer + audience.
- Lấy `email` từ payload (chữ thường) → tra bảng `admins` (active) → so cấp role.
- Hai lớp độc lập: Access chặn ở edge, Worker vẫn tự verify + phân quyền (không tin mỗi edge).

### 2.3 Dev local (không có Access)

Access không chạy ở `wrangler dev`. Để dev/test không bị chặn:
- Biến `ADMIN_DEV_EMAIL` trong `.dev.vars` (chỉ local). Nếu có và `ENVIRONMENT=dev`, middleware
  bỏ qua verify JWT và coi như đã đăng nhập bằng email đó.
- **Chặn tuyệt đối ở production**: nếu `ADMIN_DEV_EMAIL` được set mà không phải môi trường dev
  thì middleware từ chối khởi động (fail-closed). Production chỉ tin `Cf-Access-Jwt-Assertion`.
- Test dùng cùng cơ chế dev-email để giả lập các role.

> Vì sao an toàn: production không set `.dev.vars`, và biến dev chỉ có tác dụng khi `ENVIRONMENT=dev`.
> Phân quyền thật vẫn nằm ở bảng `admins`.

---

## 3. Seed admin đầu tiên

Chưa có UI để tự thêm admin đầu tiên → seed bằng SQL (giống sources):
`seed/admins.example.sql` (bạn copy, điền email thật, chạy remote một lần):

```sql
INSERT OR IGNORE INTO admins (email, role) VALUES ('ban@example.com', 'owner');
```

Owner sau đó thêm/bớt admin khác qua UI.

---

## 4. API `/admin/v1/*`

Mọi route qua `requireAdmin(minRole)`. Body/query validate bằng zod. Mọi thao tác ghi → `audit_log`.
Trả cùng format `{ data, meta }` / `{ error }` như public.

| Nhóm | Method + Path | Role | Ghi chú |
|---|---|---|---|
| Session | GET `/admin/v1/me` | viewer | Trả email + role hiện tại (UI dùng để ẩn/hiện nút) |
| Brands | GET/POST `/admin/v1/brands`, PATCH/DELETE `/admin/v1/brands/{id}` | editor | DELETE = set `active=0` (soft) |
| Products | GET/POST `/admin/v1/products`, PATCH/DELETE `/admin/v1/products/{id}` | editor | gồm max_spread_pct, max_change_pct |
| Sources | GET/POST `/admin/v1/sources`, PATCH `/admin/v1/sources/{id}` | editor | bật/tắt, interval, note, terms_checked |
| Configs | GET `/admin/v1/sources/{id}/configs`, POST (tạo version mới), POST `/activate` {version} | editor | cấu hình bất biến, rollback = activate version cũ |
| Dry-run | POST `/admin/v1/sources/{id}/preview` {config?} | editor | fetch + extract, **không ghi**; trả rows+warnings |
| Run now | POST `/admin/v1/sources/{id}/run` | editor | enqueue 1 job ngay (không chờ cron) |
| Mappings | GET `/admin/v1/sources/{id}/mappings?status=`, PATCH `/admin/v1/mappings/{sourceId}/{rawKey}` {productId\|ignore} | editor | gán nhãn→product hoặc bỏ qua |
| Reviews | GET `/admin/v1/reviews?status=pending`, POST `/{id}/approve`, POST `/{id}/reject` | editor | duyệt giá bất thường |
| Manual price | POST `/admin/v1/prices/manual` {productId, buy, sell} | editor | nhập tay, source_id='manual', qua publish |
| Crawl log | GET `/admin/v1/crawl-runs?sourceId=` | viewer | theo dõi sức khỏe nguồn |
| Admins | GET/POST `/admin/v1/admins`, PATCH/DELETE | owner | quản lý người quản trị |
| Audit | GET `/admin/v1/audit?entity=&limit=` | owner | ai sửa gì |

### 4.1 Dry-run (điểm mấu chốt)

- Nhận cấu hình đang soạn (chưa lưu) **hoặc** version đã lưu.
- Chạy `safeFetch` + `extract` (tái dùng y hệt runtime crawl, từ Phase 1).
- Trả `{ rows, warnings }` + preview mapping (rawKey nào đã map, nào mới).
- Không ghi D1/KV. Đây là cách admin thử nguồn mới trước khi bật.

### 4.2 Create config version

- `source_configs` bất biến: POST tạo version = max(version)+1, validate bằng `parseSourceConfig`
  (zod) **trước khi** lưu — cấu hình sai bị từ chối ngay.
- `activate` chỉ đổi `sources.active_config_version`; crawl lần sau dùng version mới.

---

## 5. Tách code Worker

```
services/api/src/
├── routes/
│   ├── public.ts        (đã có)
│   ├── health.ts        (đã có)
│   └── admin/
│       ├── index.ts     # gắn requireAdmin, mount các router con
│       ├── brands.ts
│       ├── products.ts
│       ├── sources.ts   # + configs, preview, run
│       ├── mappings.ts
│       ├── reviews.ts   # + manual price
│       ├── admins.ts
│       └── crawl-log.ts
├── auth/
│   └── access.ts        # requireAdmin (Access JWT / dev-email)
├── lib/
│   ├── audit.ts         # ghi audit_log
│   └── admin-schemas.ts # zod cho body admin
└── crawl/preview.ts     # dry-run tái dùng fetcher+extractor
```

`index.ts`: thêm `app.route('/admin/v1', adminRoutes)`. CORS cho hostname admin.
`jose` thêm vào dependencies.

---

## 6. `apps/admin` (React + Vite)

```
apps/admin/
├── src/
│   ├── main.tsx, App.tsx, router
│   ├── api/client.ts        # fetch /admin/v1/*, cùng origin → Access cookie tự gắn
│   ├── pages/               # Dashboard, Brands, Products, Sources, SourceEditor,
│   │                        #   Mappings, Reviews, Admins, AuditLog
│   ├── components/          # form, bảng, JSON editor + nút "Chạy thử"
│   └── lib/
├── index.html
├── vite.config.ts
├── wrangler.toml            # [assets] directory = dist, deploy static
├── tsconfig.json
└── package.json
```

- **Không nhúng secret**: admin gọi API cùng domain/qua Access; cookie `CF_Authorization` do Access
  cấp tự đi theo request. SPA chỉ hiển thị theo role lấy từ `/admin/v1/me`.
- Stack gọn: React + Vite + TypeScript, fetch thuần (hoặc TanStack Query nếu cần cache),
  một thư viện form nhẹ. Không Redux.
- Trình soạn nguồn: form các trường chính + ô JSON cho `fields`/`number`, nút **Chạy thử** gọi
  `/preview` và hiện bảng kết quả trước khi lưu/bật.

Dev: `vite dev` cho UI, trỏ API tới `wrangler dev` (dùng dev-email bypass Access).

---

## 7. Giữ snapshot nhất quán

- Khi admin đổi brand/product (tên, active, thứ tự) hoặc duyệt giá/nhập tay → gọi
  `refreshLatestSnapshot(env)` (đã có từ Phase 1) để KV + ETag cập nhật ngay.
- Approve review = chạy qua cùng `publishDomestic` → tick + latest + daily + snapshot.

---

## 8. Kiểm thử

- **Unit:** zod admin-schemas; logic approve/reject review.
- **Integration (vitest-pool-workers):**
  - requireAdmin: thiếu token → 401; email không trong `admins` → 403; viewer gọi route editor → 403.
  - CRUD brand/product; tạo + activate config version; dry-run không ghi; approve review → latest đổi.
  - audit_log có bản ghi sau thao tác ghi.
- Dùng dev-email để giả lập role trong test.

---

## 9. Thứ tự thực hiện

1. `auth/access.ts` + `lib/audit.ts` + `admin-schemas.ts`; mount `/admin/v1/me`. Test auth/role.
2. Brands + Products CRUD (+ audit + refresh snapshot). Test.
3. Sources + configs + activate; `crawl/preview.ts` + dry-run + run now. Test.
4. Mappings + Reviews + manual price. Test.
5. Admins + Audit log (owner). Test.
6. `apps/admin` SPA: dựng khung, trang danh mục, trình soạn nguồn + Chạy thử, mapping, reviews.
7. CI: thêm job admin (lint/build) vào workflow; wrangler.toml assets.
8. Verify: typecheck + test toàn bộ; `wrangler dev` thao tác thử bằng dev-email; (tùy chọn) deploy thử.

Mỗi bước tự verify trước khi sang bước sau. Backend admin (1–5) làm trước, UI (6) sau — để UI gọi vào API đã chạy được.

---

## 10. Việc bạn cần làm (song song khi tôi code backend admin)

1. **Bật Zero Trust / Access** trên dashboard; tạo Access application cho hostname admin + path `/admin`.
2. Gửi tôi: **team domain** và **AUD tag** để điền `wrangler.toml [vars]`.
3. Cho tôi **email** sẽ làm `owner` đầu tiên (để seed `admins`).
4. (Khi deploy) tạo KV/Queue remote nếu chưa (từ Phase 1), và chạy `db:sources:remote`.

Tôi có thể làm toàn bộ bước 1–5 (backend) + 6 (UI) **chạy local bằng dev-email** mà chưa cần bạn
cấu hình Access. Access chỉ bắt buộc khi deploy thật. Nên ta không bị chặn.

---

## 11. Câu cần bạn xác nhận

1. **Admin UI stack**: React + Vite + fetch thuần (nhẹ) — đồng ý? Hay bạn muốn thêm TanStack Query / thư viện UI (shadcn, MUI...)?
2. **Thứ tự**: làm xong backend admin (1–5) rồi mới UI (6) — ổn chứ? (Tôi khuyến nghị vậy.)
3. **Access ngay hay sau**: tôi code với dev-email để chạy local trước; bạn bật Access khi muốn deploy. Đồng ý?
4. Email **owner** đầu tiên (có thể gửi sau, chỉ cần trước khi deploy).
