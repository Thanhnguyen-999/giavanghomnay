# Kiến trúc "Giá Vàng Hôm Nay" — v3

> Bản gốc: `architecture.v1.md`. Đánh giá bản gốc nằm ở **Phụ lục A**.
> v3 cập nhật theo các quyết định đã chốt ở mục 0.

---

## 0. Quyết định đã chốt

| # | Quyết định | Hệ quả lên kiến trúc |
|---|---|---|
| D1 | Có **app mobile riêng** và **web riêng** | Mobile: Flutter (Android/iOS). Web công khai: Astro sinh HTML sẵn để làm SEO (Flutter web không phù hợp cho SEO). Bỏ platform `web`/`windows` khỏi project Flutter. |
| D2 | Thương hiệu, loại vàng, **nguồn dữ liệu cấu hình động từ dashboard quản trị** | Crawler thành **engine chạy theo cấu hình** (không viết code cho từng nguồn). Admin dashboard thuộc MVP. Cần versioning cấu hình, chạy thử (dry-run), mapping, kiểm duyệt giá bất thường. |
| D3 | **Xem ẩn danh**, **đăng nhập mở thêm tính năng** | API đọc công khai, không cần token. Đăng nhập người dùng qua Firebase Auth. Đăng nhập quản trị tách riêng (Cloudflare Access). Phải có chức năng xóa tài khoản trong app. |
| D4 | Stack: **Astro** (web), **React + Vite** (admin); tính năng đăng nhập theo mục 8.1 | |
| D5 | Domain web: **`https://thanhnguyen-999.github.io/`** (GitHub Pages) | GitHub Pages chỉ phục vụ file tĩnh → web build **tĩnh** (Astro `output: 'static'`), giá tải phía client. Không có subdomain `admin.` và không đặt Cloudflare Access/WAF trước github.io được → admin và API chạy trên **`*.workers.dev`**. Chi tiết mục 3.1. |

---

## 1. Hiện trạng repo (10/2026)

- Flutter app ở thư mục gốc: `lib/main.dart`, `lib/services/gold_api.dart`, dùng `http`, chưa có state management.
- Platform đã tạo: `web`, `windows` (sẽ bỏ theo D1). Chưa có `android`/`ios`.
- Dữ liệu: giá vàng thế giới × tỷ giá, quy đổi VND/lượng. **Không phải giá trong nước.**
- Chưa có backend, web, admin.

---

## 2. Nguyên tắc thiết kế

1. **D1 là nguồn sự thật duy nhất.** KV, HTML cache, cache trên máy chỉ là bản chụp.
2. **Dữ liệu sai nguy hiểm hơn dữ liệu chậm.** Giá bất thường vào hàng chờ kiểm duyệt, không publish thẳng.
3. **Cấu hình là dữ liệu, không phải code.** Nguồn mới thêm qua dashboard, không deploy lại.
4. **Mọi thay đổi cấu hình có version và audit log**, rollback được.
5. Tiền lưu **số nguyên đồng/lượng**, thời gian **unix giây UTC**, ngày giao dịch tính theo **`Asia/Ho_Chi_Minh`**.
6. Bắt đầu đơn giản; chỉ thêm thành phần khi có số liệu chứng minh cần.

---

## 3. Kiến trúc tổng thể

```
   ┌───────────────┐   ┌───────────────┐   ┌──────────────────────┐
   │ Mobile app    │   │ Web công khai │   │ Admin dashboard      │
   │ Flutter       │   │ Astro (tĩnh)  │   │ React + Vite (SPA)   │
   │ Android / iOS │   │ GitHub Pages  │   │ workers.dev + Access │
   └──────┬────────┘   └──────┬────────┘   └─────────┬────────────┘
          │ HTTPS             │ HTTPS + CORS         │ HTTPS + Access JWT
          │ /v1/*             │ /v1/*                │ /admin/v1/*
          ▼                   ▼                      ▼
   ┌──────────────────────────────────────────────────────────────┐
   │ Worker "gold-api" (Hono)                                     │
   │                                                              │
   │  fetch()      /v1/* công khai • /v1/me/* người dùng          │
   │               /admin/v1/* quản trị                           │
   │  scheduled()  mỗi phút: chọn nguồn đến hạn → CRAWL_QUEUE      │
   │               dọn dữ liệu cũ, tổng hợp ngày                  │
   │  queue()      crawl-jobs: fetch → extract → map → validate   │
   │                           → publish | quarantine             │
   │               price-alerts: đánh giá → FCM                   │
   │                                                              │
   │  D1 (dữ liệu, cấu hình)  KV (snapshot)  R2 (logo, HTML thô)   │
   └───────┬───────────────────────────────────────┬──────────────┘
           │ fetch theo cấu hình                   │ FCM HTTP v1
           ▼                                       ▼
   Nguồn giá (SJC, DOJI, PNJ, ...,          Firebase
   giá thế giới, tỷ giá)                    (Auth + Messaging)
```

Vì sao vẫn một worker cho API:

- Ba client dùng chung một API và một logic publish.
- Admin route nằm cùng worker nhưng chỉ nhận request có Access JWT hợp lệ (mục 8).

Thành phần để sau, chỉ thêm khi có số liệu cần: Durable Object realtime, Analytics Engine, tách worker crawler riêng.

### 3.1 Hosting & domain

| Thành phần | URL | Nền tảng | Ghi chú |
|---|---|---|---|
| Web công khai | `https://thanhnguyen-999.github.io/` | GitHub Pages | Build tĩnh bằng GitHub Actions |
| API | `https://gold-api.<account>.workers.dev` | Cloudflare Workers | CORS cho phép origin web và admin |
| Admin | `https://gold-admin.<account>.workers.dev` | Workers static assets | Bật Cloudflare Access cho hostname này |

Yêu cầu và hạn chế khi dùng `github.io`:

- **Phải có repo tên `Thanhnguyen-999.github.io`** để web nằm ở gốc domain (hiện URL này trả 404, tức repo chưa tồn tại hoặc chưa bật Pages). Nếu deploy từ repo `giavanghomnay`, web sẽ nằm ở `https://thanhnguyen-999.github.io/giavanghomnay/` và Astro phải đặt `base: '/giavanghomnay'`.
  Đề xuất: giữ code web trong monorepo này, GitHub Actions build `apps/web` rồi đẩy kết quả sang repo `Thanhnguyen-999.github.io` (deploy token có quyền ghi riêng repo đó).
- **Không có SSR**: nội dung SEO (tên thương hiệu, sản phẩm, mô tả, giá tại thời điểm build) được sinh lúc build; giá mới nhất do JavaScript tải từ API. Workflow build lại web theo lịch (ví dụ mỗi giờ) và khi admin sửa danh mục (`repository_dispatch`).
- **Không có WAF/Rate Limiting Rules cấp zone** trên `workers.dev`. Dùng Workers Rate Limiting binding trong code.
- **Deep link**: Android App Links (`/.well-known/assetlinks.json`) và iOS Universal Links (`/.well-known/apple-app-site-association`) cần nằm ở gốc domain, nên cũng cần repo `Thanhnguyen-999.github.io`.
- `github.io` dùng được cho MVP. Khi phát hành chính thức, nên mua domain riêng và đưa lên Cloudflare: khi đó có SSR, `admin.<domain>`, WAF và URL ổn định. Toàn bộ URL trong code đặt qua biến môi trường để đổi domain không phải sửa code.

---

## 4. Cấu trúc monorepo

```
giavanghomnay/
├── apps/
│   ├── mobile/                 # Flutter (Android/iOS) — code hiện tại chuyển vào đây
│   ├── web/                    # Astro (static), deploy lên GitHub Pages
│   └── admin/                  # React + Vite SPA, static assets trên Workers
├── services/
│   └── api/                    # Worker gold-api
│       ├── src/
│       │   ├── index.ts        # export default { fetch, scheduled, queue }
│       │   ├── routes/
│       │   │   ├── public/     # products, prices, world, news
│       │   │   ├── me/         # profile, devices, favorites, alerts
│       │   │   └── admin/      # brands, products, sources, mappings, reviews, ...
│       │   ├── crawl/          # scheduler, job runner, publish, quarantine
│       │   ├── alerts/         # evaluate, fcm
│       │   ├── auth/           # firebase.ts, access.ts
│       │   └── lib/
│       ├── migrations/
│       ├── test/
│       └── wrangler.toml
├── packages/
│   ├── shared/                 # zod schema + type dùng chung cho api/web/admin
│   └── extractor/              # engine trích xuất giá (TS thuần, không phụ thuộc Workers)
│       ├── src/
│       └── test/fixtures/      # HTML/JSON/XML mẫu
├── docs/openapi.json           # sinh từ zod; dùng làm hợp đồng cho Flutter
├── ai_docs/
├── package.json
└── pnpm-workspace.yaml         # pnpm workspaces cho phần TypeScript
```

- Phần TypeScript (api, web, admin, packages) dùng **pnpm workspaces**. Flutter nằm ngoài pnpm.
- `packages/shared` nay hữu ích vì web và admin cũng viết TypeScript. Flutter dùng `docs/openapi.json`.
- `packages/extractor` tách riêng để dùng chung cho job crawl và cho nút "Chạy thử" trên admin, test được không cần Workers.

---

## 5. Data model (D1)

```sql
-- Quy ước: giá = đồng/lượng (INTEGER); thời gian = unix giây UTC.

-- ───────── Danh mục (quản lý từ admin) ─────────
CREATE TABLE brands (
  id          TEXT PRIMARY KEY,                -- 'sjc'
  slug        TEXT NOT NULL UNIQUE,            -- dùng cho URL web: /gia-vang/sjc
  name        TEXT NOT NULL,
  logo_r2_key TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  active      INTEGER NOT NULL DEFAULT 1,
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE products (
  id             TEXT PRIMARY KEY,             -- 'sjc-bar-1l-hcm'
  brand_id       TEXT NOT NULL REFERENCES brands(id),
  slug           TEXT NOT NULL,
  name           TEXT NOT NULL,                -- 'Vàng miếng SJC 1L'
  kind           TEXT NOT NULL CHECK (kind IN ('bar', 'ring', 'jewelry')),
  purity         TEXT,                         -- '9999', '750'
  region         TEXT,                         -- 'HCM', 'HN', NULL
  max_spread_pct REAL NOT NULL DEFAULT 10,     -- ngưỡng kiểm tra chênh mua/bán
  max_change_pct REAL NOT NULL DEFAULT 5,      -- ngưỡng biến động mỗi lần cập nhật
  sort_order     INTEGER NOT NULL DEFAULT 0,
  active         INTEGER NOT NULL DEFAULT 1,
  updated_at     INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (brand_id, slug)
);

-- ───────── Nguồn dữ liệu động ─────────
CREATE TABLE sources (
  id                    TEXT PRIMARY KEY,      -- 'sjc-web'
  name                  TEXT NOT NULL,
  kind                  TEXT NOT NULL CHECK (kind IN ('domestic', 'world', 'fx')),
  enabled               INTEGER NOT NULL DEFAULT 0,
  interval_sec          INTEGER NOT NULL DEFAULT 300 CHECK (interval_sec >= 60),
  active_config_version INTEGER,               -- NULL = chưa có cấu hình chạy được
  next_run_at           INTEGER NOT NULL DEFAULT 0,
  terms_checked         INTEGER NOT NULL DEFAULT 0,  -- đã kiểm tra điều khoản sử dụng
  note                  TEXT,
  updated_at            INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Cấu hình bất biến: sửa = tạo version mới; rollback = đổi active_config_version.
CREATE TABLE source_configs (
  source_id  TEXT NOT NULL REFERENCES sources(id),
  version    INTEGER NOT NULL,
  config     TEXT NOT NULL CHECK (json_valid(config)),  -- SourceConfig (mục 6)
  note       TEXT,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (source_id, version)
);

-- Nhãn thô trong nguồn → sản phẩm. Nhãn mới xuất hiện tự thêm với status 'pending'.
CREATE TABLE source_mappings (
  source_id    TEXT NOT NULL REFERENCES sources(id),
  raw_key      TEXT NOT NULL,                  -- 'vang sjc 1l - 10l|ho chi minh'
  product_id   TEXT REFERENCES products(id),
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'mapped', 'ignored')),
  sample_buy   INTEGER,
  sample_sell  INTEGER,
  last_seen_at INTEGER NOT NULL,
  PRIMARY KEY (source_id, raw_key)
);
-- Mỗi sản phẩm chỉ có một nguồn chính tại một thời điểm.
CREATE UNIQUE INDEX uq_mapping_product
  ON source_mappings (product_id) WHERE status = 'mapped';

CREATE TABLE crawl_runs (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id      TEXT NOT NULL REFERENCES sources(id),
  config_version INTEGER NOT NULL,
  started_at     INTEGER NOT NULL,
  duration_ms    INTEGER,
  status         TEXT NOT NULL CHECK (status IN ('ok', 'partial', 'failed', 'quarantined')),
  rows_parsed    INTEGER NOT NULL DEFAULT 0,
  rows_changed   INTEGER NOT NULL DEFAULT 0,
  error          TEXT,
  raw_r2_key     TEXT                          -- HTML/JSON thô khi lỗi, để debug
);
CREATE INDEX idx_crawl_runs_source ON crawl_runs (source_id, started_at DESC);

-- Giá bất thường chờ admin duyệt.
CREATE TABLE price_reviews (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id  TEXT NOT NULL REFERENCES products(id),
  source_id   TEXT NOT NULL,
  buy         INTEGER NOT NULL,
  sell        INTEGER NOT NULL,
  prev_buy    INTEGER,
  prev_sell   INTEGER,
  reason      TEXT NOT NULL,                   -- 'spread_exceeded', 'change_exceeded', ...
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'approved', 'rejected', 'superseded')),
  reviewed_by TEXT,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  reviewed_at INTEGER
);
CREATE INDEX idx_reviews_pending ON price_reviews (status, created_at DESC);

-- ───────── Giá ─────────
CREATE TABLE price_ticks (                     -- chỉ ghi khi giá đổi
  product_id  TEXT NOT NULL REFERENCES products(id),
  recorded_at INTEGER NOT NULL,
  buy         INTEGER NOT NULL,
  sell        INTEGER NOT NULL,
  source_id   TEXT NOT NULL,                   -- 'manual' khi admin nhập tay
  PRIMARY KEY (product_id, recorded_at)
) WITHOUT ROWID;

CREATE TABLE latest_prices (
  product_id  TEXT PRIMARY KEY REFERENCES products(id),
  buy         INTEGER NOT NULL,
  sell        INTEGER NOT NULL,
  prev_buy    INTEGER,
  prev_sell   INTEGER,
  changed_at  INTEGER NOT NULL,
  checked_at  INTEGER NOT NULL,
  source_id   TEXT NOT NULL
);

CREATE TABLE price_daily (                     -- cho biểu đồ >= 1 tháng
  product_id  TEXT NOT NULL REFERENCES products(id),
  day         TEXT NOT NULL,                   -- 'YYYY-MM-DD' giờ Việt Nam
  open_sell   INTEGER NOT NULL,
  high_sell   INTEGER NOT NULL,
  low_sell    INTEGER NOT NULL,
  close_sell  INTEGER NOT NULL,
  close_buy   INTEGER NOT NULL,
  PRIMARY KEY (product_id, day)
) WITHOUT ROWID;

CREATE TABLE world_ticks (
  symbol      TEXT NOT NULL,                   -- 'XAU', 'XAG'
  recorded_at INTEGER NOT NULL,
  price_usd   REAL NOT NULL,
  usd_vnd     REAL NOT NULL,
  PRIMARY KEY (symbol, recorded_at)
) WITHOUT ROWID;

-- ───────── Người dùng (đăng nhập) ─────────
CREATE TABLE users (
  id           TEXT PRIMARY KEY,               -- Firebase UID
  email        TEXT,
  display_name TEXT,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  last_seen_at INTEGER
);

CREATE TABLE devices (
  id         TEXT PRIMARY KEY,                 -- install id do app sinh
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fcm_token  TEXT,
  platform   TEXT NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_devices_user ON devices (user_id);

CREATE TABLE favorites (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, product_id)
) WITHOUT ROWID;

CREATE TABLE price_alerts (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id        TEXT NOT NULL REFERENCES products(id),
  side              TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
  condition         TEXT NOT NULL CHECK (condition IN ('above', 'below')),
  threshold         INTEGER NOT NULL CHECK (threshold > 0),
  cooldown_sec      INTEGER NOT NULL DEFAULT 21600,
  active            INTEGER NOT NULL DEFAULT 1,
  last_triggered_at INTEGER,
  created_at        INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_alerts_product ON price_alerts (product_id, active);
CREATE INDEX idx_alerts_user    ON price_alerts (user_id);

-- ───────── Quản trị ─────────
CREATE TABLE admins (
  email      TEXT PRIMARY KEY,                 -- khớp email trong Access JWT
  role       TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  active     INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE audit_log (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  actor     TEXT NOT NULL,                     -- email admin hoặc 'system'
  action    TEXT NOT NULL,                     -- 'source.config.create', 'review.approve', ...
  entity    TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  before    TEXT,                              -- JSON
  after     TEXT,                              -- JSON
  at        INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_audit_entity ON audit_log (entity, entity_id, at DESC);
```

Ghi chú:

- `world` và `fx` dùng chung bảng `sources`/`source_configs`; kết quả ghi vào `world_ticks`.
- Tin tức (bảng `news`, chỉ metadata từ RSS) để Phase 5.
- Cron dọn `crawl_runs` và file thô trên R2 cũ hơn 30 ngày.

---

## 6. Engine nguồn dữ liệu động

### 6.1 Luồng chạy

```
scheduled() mỗi phút
  └─ chọn nguồn enabled, có config, next_run_at <= now  (claim bằng UPDATE ... RETURNING)
      └─ sendBatch → CRAWL_QUEUE (1 message / nguồn)

queue(crawl-jobs) — mỗi message xử lý 1 nguồn
  1. fetch    theo request config (timeout, giới hạn dung lượng, User-Agent riêng)
  2. extract  html | json | xml → danh sách dòng {label, region, buy, sell | price}
  3. normalize số (dấu phân cách, hệ số đơn vị) + tạo raw_key
  4. map      raw_key → product_id qua source_mappings; nhãn mới → 'pending'
  5. validate sell >= buy, spread/change trong ngưỡng của product
  6. publish  giá hợp lệ & thay đổi → price_ticks + latest_prices + price_daily
     quarantine giá bất thường → price_reviews
  7. ghi crawl_runs; lỗi thì lưu bản thô lên R2
  8. nếu có giá đổi: ghi lại KV snapshot + enqueue price-alerts
```

Bước 2–5 là hàm thuần trong `packages/extractor`. Nút **"Chạy thử"** trên admin gọi đúng các hàm này với cấu hình đang soạn, trả kết quả mà không ghi gì.

Scheduler:

```ts
// services/api/src/crawl/scheduler.ts
export async function scheduleDueSources(env: Env, now: number) {
  // Claim nguồn đến hạn trong một câu lệnh để không bị lên lịch trùng.
  const { results } = await env.DB.prepare(
    `UPDATE sources
        SET next_run_at = ?1 + interval_sec
      WHERE enabled = 1
        AND active_config_version IS NOT NULL
        AND next_run_at <= ?1
  RETURNING id, active_config_version`,
  ).bind(now).all<{ id: string; active_config_version: number }>();

  if (results.length === 0) return;

  // sendBatch tối đa 100 message mỗi lần.
  for (let i = 0; i < results.length; i += 100) {
    await env.CRAWL_QUEUE.sendBatch(
      results.slice(i, i + 100).map((s) => ({
        body: { type: 'crawl', sourceId: s.id, version: s.active_config_version, at: now },
      })),
    );
  }
}
```

### 6.2 Định dạng cấu hình (`SourceConfig`)

Cấu hình **khai báo** (declarative), không cho phép chạy code. Workers vốn cũng không cho `eval`.

```ts
// packages/shared/src/source-config.ts
import { z } from 'zod';

const Field = z.object({
  path: z.string().min(1).max(200),       // html/xml: CSS selector trong dòng; json: đường dẫn 'a.b[0]'
  attr: z.string().max(50).optional(),    // html: lấy attribute thay vì text
  regex: z.string().max(200).optional(),  // lấy capture group 1
});

export const SourceConfig = z
  .object({
    request: z.object({
      url: z.string().url().startsWith('https://'),
      method: z.enum(['GET', 'POST']).default('GET'),
      headers: z.record(z.string().max(500)).default({}),
      body: z.string().max(10_000).optional(),
      timeoutMs: z.number().int().min(1_000).max(15_000).default(8_000),
      maxBytes: z.number().int().min(1_000).max(5_000_000).default(2_000_000),
    }),
    format: z.enum(['html', 'json', 'xml']),
    rows: z.string().min(1).max(200),      // selector / đường dẫn tới danh sách dòng
    fields: z.object({
      label: Field,
      region: Field.optional(),
      buy: Field.optional(),               // domestic: bắt buộc buy + sell
      sell: Field.optional(),
      price: Field.optional(),             // world / fx: bắt buộc price
    }),
    number: z.object({
      thousandSeparator: z.enum(['.', ',', ' ', '']).default('.'),
      decimalSeparator: z.enum(['.', ',']).default(','),
      // Quy về đồng/lượng. Ví dụ: nguồn ghi "nghìn đồng/lượng" → 1000;
      // ghi "nghìn đồng/chỉ" → 10000 (1 lượng = 10 chỉ).
      multiplier: z.number().positive().default(1),
    }),
    keyTemplate: z.string().max(100).default('{label}|{region}'),
  })
  .refine((c) => c.number.thousandSeparator !== c.number.decimalSeparator, {
    message: 'Dấu phân cách hàng nghìn và thập phân phải khác nhau',
  });
```

Ví dụ một cấu hình HTML:

```json
{
  "request": { "url": "https://example.com/bang-gia-vang" },
  "format": "html",
  "rows": "table.price-table tbody tr",
  "fields": {
    "label": { "path": "td:nth-child(1)" },
    "region": { "path": "td:nth-child(1)", "regex": "\\(([^)]+)\\)" },
    "buy": { "path": "td:nth-child(2)" },
    "sell": { "path": "td:nth-child(3)" }
  },
  "number": { "thousandSeparator": ".", "decimalSeparator": ",", "multiplier": 1000 }
}
```

Lựa chọn kỹ thuật trong extractor:

- **HTML:** cấu hình động cần selector theo từng dòng, nên dùng một thư viện DOM thuần JS chạy được trên Workers. Cần đo CPU với trang thật; `HTMLRewriter` để tối ưu sau nếu trang lớn.
- **JSON:** tự viết bộ đọc đường dẫn tối giản (`a.b[0]`, `items[*]`), không dùng thư viện JSONPath có cơ chế eval.
- **XML:** chuyển sang JSON rồi dùng chung bộ đọc JSON.
- `raw_key` được chuẩn hóa: chữ thường, gộp khoảng trắng, bỏ ký tự thừa, để nhãn hơi đổi định dạng không tạo mapping mới.

### 6.3 An toàn khi chạy cấu hình do admin nhập

- Chỉ `https://`; chặn hostname là IP literal, `localhost`, domain nội bộ.
- Timeout và giới hạn dung lượng phản hồi (đọc stream, cắt khi vượt `maxBytes`).
- Header do admin nhập không được chứa secret của hệ thống; worker không tự gắn token nội bộ vào request ra ngoài.
- Giới hạn độ dài regex/selector; regex chỉ chạy trên chuỗi đã cắt ngắn.
- `interval_sec >= 60`; mỗi nguồn có User-Agent nhận diện và phải bật `terms_checked` trước khi `enabled`.

### 6.4 Kiểm duyệt giá

- Vi phạm `max_spread_pct` / `max_change_pct` → tạo `price_reviews` (giữ giá cũ trên app).
- Admin **duyệt** → publish như giá bình thường; **từ chối** → bỏ.
- Có review mới cho cùng sản phẩm → review cũ chuyển `superseded`.
- Admin có thể **nhập giá tay** (`source_id = 'manual'`), đi qua cùng hàm publish.
- Nguồn lỗi ≥ 3 lần liên tiếp → hiện cảnh báo trên dashboard và gửi thông báo cho admin.

---

## 7. Admin dashboard

React + Vite SPA, chạy tại `gold-admin.<account>.workers.dev` (mục 3.1). Toàn bộ hostname đặt sau Cloudflare Access.

| Màn hình | Chức năng | Quyền |
|---|---|---|
| Tổng quan | Tình trạng nguồn, lần crawl gần nhất, số review chờ, nhãn chưa map | viewer |
| Thương hiệu | Thêm/sửa/ẩn, logo (upload R2), thứ tự | editor |
| Sản phẩm | Thêm/sửa/ẩn, slug, loại, tuổi vàng, khu vực, ngưỡng kiểm tra | editor |
| Nguồn | Thêm/sửa, bật/tắt, chu kỳ, **trình soạn cấu hình** (form + JSON, validate realtime), **Chạy thử**, **Chạy ngay**, lịch sử version, rollback | editor |
| Mapping | Danh sách nhãn `pending` kèm giá mẫu → chọn sản phẩm hoặc bỏ qua | editor |
| Kiểm duyệt | Duyệt/từ chối giá bất thường, nhập giá tay | editor |
| Nhật ký crawl | `crawl_runs`, lỗi, xem bản thô trên R2 | viewer |
| Quản trị viên | Thêm/xóa admin, phân quyền | owner |
| Audit log | Ai sửa gì, lúc nào, trước/sau | owner |

Khi admin sửa thương hiệu/sản phẩm, API ghi lại KV snapshot để app và web thấy ngay tên mới.

---

## 8. Xác thực & phân quyền

| Đối tượng | Cơ chế | Phạm vi |
|---|---|---|
| Khách (ẩn danh) | Không cần token | `/v1/*` chỉ đọc |
| Người dùng đăng nhập | Firebase Auth → ID token → Worker verify (`jose`, JWKS của Google) | `/v1/me/*` |
| Quản trị viên | Cloudflare Access trước hostname admin (và route `/admin/v1/*` của API) → Worker verify header `Cf-Access-Jwt-Assertion` + tra role trong bảng `admins` | `/admin/v1/*` |

### 8.1 Người dùng

- Nhà cung cấp đăng nhập: Google, **Sign in with Apple** (nên có trên iOS khi cung cấp đăng nhập bên thứ ba, theo App Store Guideline 4.8), email.
- Yêu thích khi chưa đăng nhập lưu trên máy; khi đăng nhập, app gửi lên `POST /v1/me/favorites/merge` để gộp.
- **Xóa tài khoản trong app** (`DELETE /v1/me`): bắt buộc với app có tạo tài khoản theo App Store Guideline 5.1.1(v). Xóa dữ liệu D1 (cascade), xóa user Firebase qua Admin API; nếu dùng Sign in with Apple thì thu hồi token.
- Tính năng chỉ dành cho người đăng nhập (đề xuất, cần xác nhận ở mục 15): cảnh báo giá cá nhân, đồng bộ yêu thích nhiều thiết bị, sổ vàng (ghi giao dịch mua, tính lãi/lỗ theo giá hiện tại), cài đặt thông báo.
- Khách vẫn có thể nhận **thông báo chung** (ví dụ "SJC biến động > 1 triệu") qua FCM topic, không cần lưu thiết bị trên server.

### 8.2 Quản trị viên

```ts
// services/api/src/auth/access.ts
import { createMiddleware } from 'hono/factory';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { AppEnv } from '../types';

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

export const requireAdmin = (minRole: 'viewer' | 'editor' | 'owner') =>
  createMiddleware<AppEnv>(async (c, next) => {
    const token = c.req.header('Cf-Access-Jwt-Assertion');
    if (!token) return c.json({ error: { code: 'unauthorized', message: 'Missing Access token' } }, 401);

    const teamDomain = c.env.ACCESS_TEAM_DOMAIN; // https://<team>.cloudflareaccess.com
    jwks ??= createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`));

    let email: string;
    try {
      const { payload } = await jwtVerify(token, jwks, {
        issuer: teamDomain,
        audience: c.env.ACCESS_AUD,              // Application Audience (AUD) tag
      });
      email = String(payload.email ?? '').toLowerCase();
    } catch {
      return c.json({ error: { code: 'unauthorized', message: 'Invalid Access token' } }, 401);
    }

    const admin = await c.env.DB.prepare(
      'SELECT role FROM admins WHERE email = ? AND active = 1',
    ).bind(email).first<{ role: 'viewer' | 'editor' | 'owner' }>();

    const rank = { viewer: 1, editor: 2, owner: 3 } as const;
    if (!admin || rank[admin.role] < rank[minRole]) {
      return c.json({ error: { code: 'forbidden', message: 'Insufficient role' } }, 403);
    }

    c.set('adminEmail', email);
    await next();
  });
```

Access chặn ở edge, worker verify lại JWT và kiểm tra role. Hai lớp này độc lập với nhau, nên nếu một lớp cấu hình sai thì lớp còn lại vẫn chặn.

---

## 9. API contract

Format chung:

```json
{ "data": [], "meta": { "updated_at": 1791849451 } }
{ "error": { "code": "invalid_input", "message": "threshold must be > 0" } }
```

### 9.1 Công khai `/v1` (không cần token)

| Method | Path | Ghi chú |
|---|---|---|
| GET | `/v1/brands` | Thương hiệu đang hoạt động |
| GET | `/v1/products?brand=` | |
| GET | `/v1/prices/latest` | KV snapshot, `ETag`, `Cache-Control: public, max-age=30` |
| GET | `/v1/prices/{productId}/history?range=1d\|1w\|1m\|3m\|6m\|1y` | 1d/1w từ `price_ticks`, còn lại từ `price_daily` |
| GET | `/v1/world/latest` | XAU/XAG, tỷ giá, giá quy đổi |
| GET | `/v1/news?cursor=&limit=20` | Phase 5 |

### 9.2 Người dùng `/v1/me` (Firebase ID token)

| Method | Path | Ghi chú |
|---|---|---|
| GET / DELETE | `/v1/me` | Hồ sơ / xóa tài khoản |
| PUT / DELETE | `/v1/me/devices/{installId}` | Đăng ký/gỡ FCM token |
| GET / PUT | `/v1/me/favorites` | |
| POST | `/v1/me/favorites/merge` | Gộp yêu thích từ máy khi vừa đăng nhập |
| GET / POST | `/v1/me/alerts` | Tối đa 20 alert/người dùng |
| PATCH / DELETE | `/v1/me/alerts/{id}` | Chỉ alert của chính mình |

### 9.3 Quản trị `/admin/v1` (Access JWT + role)

| Nhóm | Endpoint chính | Role tối thiểu |
|---|---|---|
| Danh mục | `brands`, `products` (CRUD), `uploads/logo` | editor |
| Nguồn | `sources` (CRUD), `sources/{id}/configs` (GET, POST version mới), `sources/{id}/activate`, `sources/{id}/preview` (dry-run), `sources/{id}/run` | editor |
| Mapping | `mappings?status=pending`, `PATCH mappings/{sourceId}/{rawKey}` | editor |
| Kiểm duyệt | `reviews`, `reviews/{id}/approve`, `reviews/{id}/reject`, `prices/manual` | editor |
| Giám sát | `crawl-runs`, `crawl-runs/{id}/raw` | viewer |
| Quản trị | `admins`, `audit-log` | owner |

Mọi body/query validate bằng zod trong `packages/shared`. Spec OpenAPI sinh từ cùng schema (ví dụ `@hono/zod-openapi`) và xuất ra `docs/openapi.json`.

---

## 10. Cache

| Tầng | Cách làm |
|---|---|
| KV `prices:latest:v1` | Ghi lại mỗi khi giá đổi hoặc admin sửa danh mục. API đọc KV, thiếu thì fallback D1. |
| HTTP API | `ETag` theo `changed_at` lớn nhất; client gửi `If-None-Match` → `304`. |
| HTML web | File tĩnh trên GitHub Pages (CDN của GitHub); giá trong HTML là giá lúc build, JavaScript cập nhật giá mới khi trang mở. |
| Mobile | Lưu response cuối; mở app hiện ngay dữ liệu cũ kèm "cập nhật lúc HH:mm", rồi gọi lại. |

Realtime: polling 60s khi app/web đang mở, dừng khi app ở background. WebSocket (Durable Object) chỉ thêm nếu chu kỳ nguồn xuống dưới 1 phút.

---

## 11. Cảnh báo giá

Queue `price-alerts` nhận `{ productIds }` sau mỗi lần publish:

```sql
SELECT a.id, a.user_id, a.product_id, a.side, a.condition, a.threshold,
       l.buy, l.sell, l.prev_buy, l.prev_sell
FROM price_alerts a
JOIN latest_prices l ON l.product_id = a.product_id
WHERE a.active = 1
  AND a.product_id IN (/* productIds */)
  AND (a.last_triggered_at IS NULL OR a.last_triggered_at + a.cooldown_sec <= ?now);
```

- Kích hoạt khi **cắt qua** ngưỡng: `above` khi `prev < threshold <= current`, `below` khi `prev > threshold >= current`.
- Gửi tới mọi `devices` của user; cập nhật `last_triggered_at` theo batch.
- FCM trả `UNREGISTERED` → xóa token khỏi `devices`.
- Access token của service account cache trong KV ~50 phút.
- Nhiều push trong một lần chạy → chia nhỏ message để không vượt giới hạn subrequest.

---

## 12. Web công khai (`apps/web`)

- **Astro** `output: 'static'`, deploy lên GitHub Pages bằng GitHub Actions (mục 3.1).
- Lúc build: gọi `/v1/brands`, `/v1/products`, `/v1/prices/latest` để sinh trang tĩnh cho từng thương hiệu/sản phẩm (SEO).
- Lúc chạy: island phía client tải giá mới nhất, biểu đồ, đăng nhập, yêu thích, cảnh báo từ API (cần CORS).
- Build lại theo lịch và khi admin sửa danh mục (`repository_dispatch`), để trang mới xuất hiện mà không cần deploy tay.
- Trang:
  - `/` — bảng giá hôm nay (tất cả thương hiệu)
  - `/gia-vang/[brand]` — giá theo thương hiệu
  - `/gia-vang/[brand]/[product]` — chi tiết + biểu đồ
  - `/gia-vang-the-gioi`
  - `/tai-khoan` — đăng nhập, yêu thích, cảnh báo
  - `/chinh-sach-bao-mat`, `/dieu-khoan`
- SEO: `<title>`/meta theo từng trang, canonical, `sitemap.xml` sinh từ bảng `products`, URL dùng slug do admin đặt.
- Accessibility: bảng giá dùng `<table>` với `<caption>`, `<th scope>`; tăng/giảm có chữ và icon chứ không chỉ màu; điều hướng được bằng bàn phím.
- Đăng nhập trên web dùng Firebase JS SDK, gọi cùng `/v1/me/*`.

---

## 13. Mobile (`apps/mobile`, Flutter)

### 13.1 Stack

| Mục đích | Package |
|---|---|
| State | `flutter_riverpod` |
| HTTP | `dio` (interceptor gắn ID token khi đã đăng nhập, ETag) |
| Cache trên máy | `shared_preferences` (snapshot JSON); chuyển `drift` nếu cần truy vấn |
| Model | `freezed` + `json_serializable` |
| Biểu đồ | `fl_chart` |
| Firebase | `firebase_core`, `firebase_auth`, `firebase_messaging`, `google_sign_in`, `sign_in_with_apple` |
| Định dạng | `intl` |

Thêm package bằng `flutter pub add` (bản ổn định mới nhất) và commit `pubspec.lock`.

### 13.2 Cấu trúc `lib/`

```
lib/
├── main.dart
├── app/                  # app.dart, router.dart, theme.dart
├── core/
│   ├── config/           # env.dart (API_BASE_URL qua --dart-define)
│   ├── network/          # api_client.dart, api_exception.dart
│   ├── cache/
│   └── format/           # vnd.dart, luong.dart
├── features/
│   ├── prices/           # giá trong nước
│   ├── world/            # giá thế giới quy đổi (gold_api.dart hiện tại chuyển vào đây)
│   ├── chart/
│   ├── auth/             # đăng nhập, xóa tài khoản
│   ├── favorites/        # cục bộ + đồng bộ khi đăng nhập
│   ├── alerts/           # chỉ khi đăng nhập
│   └── settings/
└── shared/widgets/
```

### 13.3 Repository: cache trước, mạng sau

```dart
// lib/features/prices/data/price_repository.dart
class PriceRepository {
  PriceRepository(this._api, this._cache);

  final ApiClient _api;
  final SnapshotCache _cache;

  /// Phát dữ liệu cache (nếu có) ngay, sau đó dữ liệu mới từ server.
  Stream<PriceSnapshot> watchLatest() async* {
    final cached = await _cache.readLatest();
    if (cached != null) yield cached;

    try {
      // Trả null khi server trả 304 Not Modified.
      final fresh = await _api.getLatestPrices(etag: cached?.etag);
      if (fresh != null) {
        await _cache.writeLatest(fresh);
        yield fresh;
      }
    } on ApiException {
      // Có cache thì giữ cache, UI hiển thị banner offline; không có thì báo lỗi.
      if (cached == null) rethrow;
    }
  }
}
```

### 13.4 Màn hình

Bottom nav: **Trong nước | Thế giới | Biểu đồ | Tài khoản**.
Tab Tài khoản: khách thấy nút đăng nhập + cài đặt; người đăng nhập thấy thêm yêu thích đồng bộ, cảnh báo, xóa tài khoản.

### 13.5 UI/UX

- Luôn hiển thị nguồn và "cập nhật lúc HH:mm"; ghi rõ "giá tham khảo".
- Tăng/giảm dùng màu + mũi tên + dấu ±.
- Vàng `#FFD700` chỉ làm màu nhấn/nền; chữ dùng tông đậm để đủ tương phản.
- `Semantics` cho ô giá; hỗ trợ dark mode và cỡ chữ hệ thống.

---

## 14. Bảo mật & vận hành

- **Secret** (`wrangler secret put`): `FCM_SERVICE_ACCOUNT`, `FIREBASE_ADMIN_*`. Biến không bí mật: `FIREBASE_PROJECT_ID`, `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`. Local dùng `.dev.vars` (trong `.gitignore`).
- **Rate limit:** Workers Rate Limiting binding cho `/v1/*` và route ghi (WAF cấp zone không có trên `workers.dev`).
- **CORS:** chỉ cho `https://thanhnguyen-999.github.io` và hostname admin. Mobile không cần CORS.
- **Firebase Auth:** thêm `thanhnguyen-999.github.io` vào Authorized domains.
- **Audit log** cho mọi thao tác ghi ở `/admin/v1`.
- **Giám sát:** `[observability]`, `wrangler tail`, dashboard nguồn, thông báo khi nguồn lỗi liên tiếp hoặc review chờ quá lâu.
- **Backup:** export D1 định kỳ lên R2 (D1 có Time Travel, nhưng nên có bản export riêng).
- **Pháp lý:** kiểm tra điều khoản từng nguồn trước khi bật; ghi nguồn trên app/web; disclaimer "giá tham khảo"; privacy policy theo Nghị định 13/2023/NĐ-CP (email, Firebase UID, FCM token); Play/App Store yêu cầu URL privacy policy và chức năng xóa tài khoản.

---

## 15. Roadmap

| Phase | Nội dung | Thời gian (1 người) | Hoàn thành khi |
|---|---|---|---|
| 0. Monorepo | Nâng Node lên 22 LTS (máy đang dùng 16, Astro/wrangler không chạy); pnpm workspace; chuyển Flutter vào `apps/mobile`, thêm android/ios, bỏ web/windows; tái cấu trúc `lib/` + Riverpod; CI cơ bản | 3–4 ngày | Mobile chạy trên Android emulator; CI chạy analyze/test |
| 1. Lõi backend | Migrations, `packages/extractor` (html/json/xml) + fixture test, scheduler + queue, publish/quarantine, API công khai | ~2 tuần | Một nguồn thật chạy 3 ngày không có giá sai |
| 2. Admin MVP | Access + bảng `admins`, CRUD danh mục, trình soạn cấu hình + Chạy thử + version/rollback, mapping, kiểm duyệt, nhật ký crawl, audit | ~2 tuần | Admin thêm được nguồn và sản phẩm mới, thấy giá publish, **không cần sửa code** |
| 3. Mobile + Web MVP | Bảng giá, thế giới, biểu đồ, cache offline (mobile); trang tĩnh + SEO, workflow build/deploy lên GitHub Pages (web). Hai app làm song song được | ~2–3 tuần | Cả hai dùng chung API, dữ liệu khớp nhau |
| 4. Đăng nhập | Firebase Auth (Google/Apple/email), `users`/`devices`, yêu thích đồng bộ + merge, cảnh báo → FCM, xóa tài khoản | ~1,5 tuần | Push đúng một lần khi cắt ngưỡng; xóa tài khoản xóa sạch dữ liệu |
| 5. Mở rộng | Tin tức (RSS), sổ vàng, thông báo topic cho khách, realtime nếu cần | Theo nhu cầu | |
| 6. Phát hành | Privacy policy, Crashlytics, icon/splash, store listing, domain chính thức | ~1 tuần | Được duyệt trên Play và App Store |

Tổng thực tế cho MVP (Phase 0–4, có thêm Phase 6 để phát hành): khoảng **9–11 tuần** cho một người.

---

## 16. Chi phí

| Hạng mục | Ước tính | Hạn mức Free |
|---|---|---|
| Worker requests | ~10.000–20.000/ngày ở 1.000 người dùng hoạt động (poll 60s + web) | 100.000/ngày |
| CPU | Parse HTML bằng DOM parser có thể vượt 10ms/lần với trang lớn | 10ms/lần chạy |
| Queues | Mỗi message ≈ 3 operation (ghi/đọc/xóa). 10 nguồn × 5 phút ≈ 2.880 message ≈ 8.640 ops/ngày | 10.000 ops/ngày |
| KV writes | Mỗi lần giá đổi hoặc admin sửa danh mục | 1.000/ngày |
| R2 | Logo + bản thô khi lỗi (dọn sau 30 ngày) | 10 GB |
| Cloudflare Access | Vài admin | Miễn phí tới 50 người dùng |
| Firebase Auth + FCM | | Miễn phí ở quy mô này |

Kết luận: chạy thử được trên Free, nhưng **nên dự trù Workers Paid ($5/tháng) từ Phase 1**. Lý do là Queues gần chạm hạn mức khi có khoảng 10 nguồn, và parse HTML dễ vượt giới hạn CPU của gói Free.

Nguồn (kiểm tra 10/2026, nội dung được diễn đạt lại):
[Queues trên Free plan](https://developers.cloudflare.com/changelog/2026-02-04-queues-free-plan/) ·
[Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/) ·
[Durable Objects trên Free plan](https://developers.cloudflare.com/changelog/post/2025-04-07-durable-objects-free-tier/) ·
[Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) ·
[Validate Access JWT](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/) ·
[Apple: xóa tài khoản trong app](https://developer.apple.com/support/offering-account-deletion-in-your-app).

---

## 17. Câu hỏi còn mở

Đã chốt: stack (D4), tính năng đăng nhập (D4), domain (D5).

1. **Repo `Thanhnguyen-999.github.io`:** tạo repo này để web nằm ở gốc domain, hay chấp nhận đường dẫn `/giavanghomnay/`?
2. **Phương thức đăng nhập:** Google + Apple + email đã đủ chưa? Có cần số điện thoại (OTP SMS tốn phí) không?
3. **Ngân sách:** đồng ý $5/tháng từ Phase 1?
4. **Thông báo cho khách** qua FCM topic: có cần ở MVP không?
5. **Domain riêng** khi phát hành chính thức: có kế hoạch không?

---

## Phụ lục A — Đánh giá bản v1

🔴 sai/nguy hiểm · 🟠 thiết kế/chi phí · 🟡 cải thiện

| # | Vấn đề trong v1 | Mức | Đã xử lý ở |
|---|---|---|---|
| 1 | API không xác thực; `POST /api/alerts` nhận `userId` từ body; zod khai báo nhưng không dùng | 🔴 | Mục 8, 9 |
| 2 | `last_triggered_at` không được cập nhật → push lặp mỗi 5 phút; `change_percent` không xử lý | 🔴 | Mục 11 |
| 3 | Không có chiều "sản phẩm" (miếng/nhẫn/nữ trang, khu vực) | 🔴 | Mục 5 |
| 4 | Đơn vị giá lệch (nghìn đồng INTEGER vs threshold REAL) | 🔴 | Mục 2, 5 |
| 5 | DO khai báo ở worker `api` nhưng class nằm ở worker khác → deploy lỗi; crawler không gọi được `broadcast`; giữ `sessions` trong RAM khi dùng Hibernation API | 🔴 | Mục 10 (bỏ khỏi MVP) |
| 6 | Secret trong `[vars]`; FCM Server Key là API legacy đã tắt | 🔴 | Mục 14 |
| 7 | Lưu toàn văn tin tức + AI tóm tắt → rủi ro bản quyền | 🔴 | Mục 5 (chỉ metadata RSS) |
| 8 | Crawler không validate; parser hỏng → giá sai tới người dùng | 🔴 | Mục 6.4 |
| 9 | 4 worker + DO + Queue + R2 + Pages + AI cho MVP | 🟠 | Mục 3 |
| 10 | Ghi lịch sử mỗi 5 phút dù không đổi; chart 1 năm quá nhiều điểm | 🟠 | Mục 5 (`price_daily`) |
| 11 | Correlated subquery cho "giá mới nhất" | 🟠 | Mục 5 (`latest_prices`) |
| 12 | Invalidate KV bằng `delete` → miss đồng loạt | 🟠 | Mục 10 (write-through) |
| 13 | Enqueue kiểm tra cảnh báo mỗi lượt; quét toàn bảng alerts | 🟠 | Mục 11 |
| 14 | Thông tin nền tảng lỗi thời (DO/Queues đã có ở Free, `node_compat` deprecated) | 🟠 | Mục 16 |
| 15 | `packages/shared` TS không dùng được cho Flutter | 🟠 | Mục 4 (OpenAPI cho Flutter; shared TS cho web/admin) |
| 16 | Không versioning API, pagination, ETag | 🟠 | Mục 9, 10 |
| 17 | Hiểu sai CORS là cơ chế bảo vệ cho app mobile | 🟡 | Mục 14 |
| 18 | Admin không có bảo vệ truy cập | 🟠 | Mục 7, 8.2 |
| 19 | `DioClient` cache là code rỗng | 🟠 | Mục 13.3 |
| 20 | `RealtimeService` thiếu import, reconnect không backoff, chạy cả sau `dispose()` | 🟠 | Bỏ khỏi MVP |
| 21 | Clean Architecture đầy đủ cho app chủ yếu đọc dữ liệu → boilerplate | 🟡 | Mục 13.2 (feature-first) |
| 22 | `workmanager` kiểm tra cảnh báo trùng với server; iOS không đảm bảo chạy nền | 🟡 | Cảnh báo phía server |
| 23 | Thiếu android/ios, privacy policy, xóa tài khoản, giám sát crawler, múi giờ | 🟠 | Mục 8.1, 14, 15 |
| 24 | Roadmap 5–6 tuần lạc quan, realtime xếp trước khi crawler ổn định | 🟡 | Mục 15 |
