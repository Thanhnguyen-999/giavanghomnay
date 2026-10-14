# Phase 1 — Lõi backend (kế hoạch chi tiết)

> Tài liệu triển khai cho Phase 1. Dựa trên `architecture.md` (mục 4–11).
> Mục tiêu: backend tự chạy, có **giá vàng trong nước thật**, API đọc hoàn chỉnh — chưa cần admin UI, chưa cần đăng nhập.

---

## 0. Hiện trạng (đầu Phase 1)

- `services/api`: Worker Hono, D1 `gold-db` (18 bảng) đã có cả local lẫn remote (APAC).
- API đọc tạm: `/health`, `/v1/brands`, `/v1/products`, `/v1/prices/latest` (đọc thẳng D1, chưa cache).
- Chưa có: KV, Queues, cron, engine trích xuất, nguồn dữ liệu, validate, tổng hợp ngày, ETag.

---

## 1. Phạm vi Phase 1

**Có:**
1. `packages/extractor` — engine trích xuất giá thuần TS (html/json/xml), test bằng fixture.
2. Vòng crawl: cron → scheduler → Queue → fetch → extract → map → validate → publish/quarantine.
3. Ghi giá: `price_ticks` (chỉ khi đổi) + `latest_prices` (upsert) + `price_daily` (tổng hợp ngày giờ VN).
4. KV snapshot (write-through) + ETag/304 cho endpoint đọc nhiều.
5. API đọc hoàn chỉnh: brands, products, prices/latest, prices/history, world/latest.
6. Nguồn ban đầu: **giá thế giới + tỷ giá** (chắc chắn chạy được) và **1 nguồn trong nước** để kiểm chứng pipeline.
7. Seed cấu hình nguồn + mapping qua file SQL (vì chưa có admin UI).
8. Test: unit cho extractor/validate, integration cho vòng crawl bằng `vitest-pool-workers`.

**Chưa có (để Phase sau):**
- Admin UI (Phase 2) — Phase 1 cấu hình nguồn bằng SQL seed và lệnh thủ công.
- Đăng nhập, `/v1/me/*`, cảnh báo FCM (Phase 4).
- R2 lưu HTML thô: tùy chọn: Phase 1 lưu đoạn lỗi vào `crawl_runs.error`, R2 để sau.
- Durable Object realtime.

---

## 2. Thành phần hạ tầng cần thêm

| Thành phần | Lệnh tạo | Binding | Vai trò |
|---|---|---|---|
| KV namespace | `wrangler kv namespace create CACHE` | `CACHE` | Snapshot `prices:latest`, cache nhỏ |
| Queue (crawl) | `wrangler queues create crawl-jobs` | `CRAWL_QUEUE` | Mỗi message = 1 nguồn đến hạn |
| Queue (DLQ) | `wrangler queues create crawl-jobs-dlq` | — | Message lỗi sau khi hết retry |
| Cron | khai trong `wrangler.toml` | — | `* * * * *` (mỗi phút) gọi scheduler |

`alerts` queue để Phase 4. Phase 1 chỉ cần `crawl-jobs`.

`wrangler.toml` bổ sung:

```toml
[[kv_namespaces]]
binding = "CACHE"
id = "<điền sau khi tạo>"

[[queues.producers]]
binding = "CRAWL_QUEUE"
queue = "crawl-jobs"

[[queues.consumers]]
queue = "crawl-jobs"
max_batch_size = 5
max_batch_timeout = 10
max_retries = 2
dead_letter_queue = "crawl-jobs-dlq"

[triggers]
crons = ["* * * * *"]
```

> Lưu ý Free plan: Queues ~10.000 ops/ngày. 1 message ≈ 3 ops (ghi/đọc/xóa). Số nguồn × (1440/chu kỳ phút) × 3 phải < 10.000. Vài nguồn chu kỳ 5 phút là an toàn; đây là lý do dự trù Workers Paid khi mở rộng.

---

## 3. `packages/extractor`

Package TS thuần (không import gì của Workers) để test nhanh và tái dùng cho nút "Chạy thử" của admin ở Phase 2.

```
packages/extractor/
├── src/
│   ├── index.ts          # extract(config, body, contentType) → ExtractResult
│   ├── config.ts         # zod SourceConfig (architecture.md mục 6.2)
│   ├── html.ts           # parse HTML theo selector từng dòng
│   ├── json.ts           # đọc đường dẫn 'a.b[0]', 'items[*]'
│   ├── xml.ts            # xml → json rồi dùng json.ts
│   ├── number.ts         # chuẩn hóa số theo separator + multiplier → đồng/lượng
│   ├── rawkey.ts         # chuẩn hóa nhãn → raw_key ổn định
│   └── types.ts
├── test/
│   ├── fixtures/         # html/json/xml mẫu từng nguồn
│   └── *.test.ts
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

Hợp đồng:

```ts
export interface ExtractedRow {
  rawKey: string;
  label: string;
  region?: string;
  buy?: number;   // đồng/lượng, đã nhân multiplier
  sell?: number;
  price?: number; // world/fx
}

export interface ExtractResult {
  rows: ExtractedRow[];
  warnings: string[];   // dòng bỏ qua, thiếu field... (hiển thị ở dry-run)
}

export function extract(
  config: SourceConfig,
  body: string,
  contentType?: string,
): ExtractResult;
```

Thư viện parse HTML: dùng **`node-html-parser`** (nhẹ, chạy trên Workers với `nodejs_compat`, API querySelector). Sẽ đo CPU với trang thật; nếu nặng thì tối ưu bằng `HTMLRewriter` sau. XML dùng **`fast-xml-parser`**. JSON path tự viết (tránh thư viện có eval).

Nguyên tắc: extractor **không bao giờ ném** vì dữ liệu xấu — luôn trả `rows` + `warnings`. Lỗi cấu hình sai (zod) mới ném, và được bắt ở lớp gọi.

---

## 4. Vòng crawl trong Worker

```
services/api/src/
├── index.ts                 # fetch + scheduled + queue (đã có fetch)
├── crawl/
│   ├── scheduler.ts         # chọn nguồn đến hạn → enqueue (architecture.md mục 6.1)
│   ├── runner.ts            # xử lý 1 message: fetch → extract → map → validate → publish
│   ├── fetcher.ts           # fetch an toàn (https, timeout, maxBytes, UA)
│   ├── validate.ts          # quy tắc spread/change theo product
│   └── publish.ts           # D1 batch + KV write-through
├── routes/
│   ├── public.ts            # brands, products, prices, world (tách khỏi index)
│   └── health.ts
├── lib/
│   ├── cache.ts             # đọc/ghi KV snapshot, tính ETag
│   ├── time.ts              # vnDay(now) theo Asia/Ho_Chi_Minh
│   ├── errors.ts            # định dạng lỗi { error: { code, message } }
│   └── db.ts                # helper truy vấn hay dùng
└── types.ts                 # AppEnv, Bindings
```

### 4.1 scheduled() — mỗi phút

- Claim nguồn đến hạn bằng một câu `UPDATE ... RETURNING` (đặt `next_run_at = now + interval_sec`) để không enqueue trùng.
- `CRAWL_QUEUE.sendBatch` theo lô ≤ 100.
- Ngoài ra: dọn `price_ticks`/`crawl_runs` cũ (giữ ví dụ 400 ngày), chạy thưa (không mỗi phút).

### 4.2 queue(crawl-jobs) — mỗi message 1 nguồn

Các bước (mục 6.1 của architecture):

1. Đọc `source` + `source_configs` theo `version` trong message. Version không khớp active → bỏ qua (cấu hình đã đổi).
2. `fetcher.fetch(config.request)` — chặn URL không https, hostname nội bộ/IP; cắt theo `maxBytes`; `AbortSignal.timeout`.
3. `extract(config, body)` → rows + warnings.
4. **Map + cập nhật `source_mappings`**: upsert `last_seen_at`, `sample_buy/sell`; nhãn mới → `pending`. Chỉ lấy dòng `status='mapped'` có `product_id` để xét giá.
5. **Validate** (`validate.ts`): với mỗi product đã map, so với `latest_prices`:
   - `sell >= buy`, `buy > 0`.
   - spread `(sell-buy)/sell` ≤ `max_spread_pct`.
   - thay đổi so với giá trước ≤ `max_change_pct`.
   - vi phạm → tạo `price_reviews` (quarantine), **không** cập nhật latest.
6. **Publish** (`publish.ts`): các product hợp lệ & có thay đổi → D1 `batch`:
   - `INSERT OR IGNORE price_ticks`
   - `UPSERT latest_prices` (dời `buy→prev_buy`)
   - `UPSERT price_daily` (open/high/low/close theo `vnDay`)
7. Nếu có product đổi → `cache.writeLatestSnapshot()` (ghi KV) — write-through.
8. Ghi `crawl_runs` (status ok/partial/failed/quarantined, rows_parsed/changed, error).
9. Cập nhật `sources`/`source_mappings` state. `msg.ack()`; lỗi hạ tầng → `msg.retry()`.

Giá thế giới (`kind='world'/'fx'`): publish vào `world_ticks` thay vì `latest_prices` (nhánh riêng trong runner).

---

## 5. Validate (chi tiết)

```ts
export type Decision =
  | { action: 'publish'; buy: number; sell: number }
  | { action: 'quarantine'; reason: string; buy: number; sell: number }
  | { action: 'skip' };  // không đổi so với latest

export function decide(
  product: { maxSpreadPct: number; maxChangePct: number },
  prev: { buy: number; sell: number } | null,
  next: { buy: number; sell: number },
): Decision;
```

- `next.buy <= 0 || next.sell < next.buy` → quarantine `invalid_range`.
- spread vượt → quarantine `spread_exceeded`.
- prev tồn tại và |next.sell-prev.sell|/prev.sell > maxChangePct (hoặc buy) → quarantine `change_exceeded`.
- prev tồn tại và bằng y hệt → skip.
- còn lại → publish.

Thuần hàm, test không cần D1.

---

## 6. Cache & ETag

- Key KV: `prices:latest:v1`. Giá trị: JSON `{ updatedAt, items: [...] }`.
- Ghi: cuối mỗi lần publish có thay đổi (write-through). Admin sửa danh mục (Phase 2) cũng ghi lại.
- `/v1/prices/latest`: đọc KV; miss → query D1 `latest_prices` + ghi lại KV.
- ETag = hash ngắn của `max(changed_at)` + số item. Client gửi `If-None-Match` → `304`.
- `Cache-Control: public, max-age=30`.

---

## 7. API đọc hoàn chỉnh (Phase 1)

| Method | Path | Nguồn | Cache |
|---|---|---|---|
| GET | `/health` | D1 | no-store |
| GET | `/v1/brands` | D1 | max-age=300 |
| GET | `/v1/products?brand=` | D1 | max-age=300 |
| GET | `/v1/prices/latest` | KV → D1 | max-age=30 + ETag |
| GET | `/v1/prices/{productId}/history?range=1d\|1w\|1m\|3m\|6m\|1y` | `price_ticks` (1d/1w) / `price_daily` | max-age=60 |
| GET | `/v1/world/latest` | D1 `world_ticks` + quy đổi | max-age=30 |

Mọi response giữ format `{ data, meta }` / `{ error: { code, message } }`.
Query validate bằng zod (range nằm trong tập cho phép, productId tồn tại).

---

## 8. Cấu hình nguồn ban đầu (seed, chưa có admin)

Thêm `services/api/seed/sources.sql` (chạy cả local lẫn remote vì đây là cấu hình vận hành thật, khác `dev.sql` chỉ cho local):

1. **`world-metal`** (`kind='world'`): gold-api.com cho XAU, XAG. Config JSON cắm sẵn.
2. **`fx-usd-vnd`** (`kind='fx'`): open.er-api.com.
3. **`sjc`** (`kind='domestic'`): một nguồn trong nước để kiểm chứng. **Chỉ bật sau khi**:
   - kiểm tra điều khoản sử dụng của trang,
   - viết fixture + test parser,
   - set `terms_checked=1`.

Nếu Phase 1 chưa chốt được nguồn trong nước hợp lệ, pipeline vẫn hoàn chỉnh và chạy thật với world+fx; nguồn trong nước bật sau mà không đổi code.

Mapping giá thế giới → "sản phẩm" ảo (XAU/XAG) hoặc đi nhánh `world_ticks` (ưu tiên nhánh world_ticks, không tạo product giả).

---

## 9. Kiểm thử

- **Unit (vitest thường):** `packages/extractor` (html/json/xml/number/rawkey), `validate.decide`, `time.vnDay`.
- **Integration (`@cloudflare/vitest-pool-workers`):** nạp schema vào D1 test, giả lập response nguồn (fixture), chạy `runner` một vòng, kiểm tra `latest_prices`/`price_ticks`/`price_daily`/`price_reviews`/KV.
- **Thủ công:** `wrangler dev`, gọi endpoint `/admin-less` nội bộ `POST /internal/crawl/{sourceId}` (chỉ bật ở dev, chặn ở production) để chạy một vòng crawl mà không chờ cron.

CI: thêm job `backend` vào workflow (pnpm install → typecheck → vitest).

---

## 10. Thứ tự thực hiện

1. `packages/extractor` + test fixture (world/fx trước, html sau). *Chạy được, test xanh.*
2. `wrangler.toml`: thêm KV + Queue + cron; tạo tài nguyên; `wrangler types`.
3. `lib/` (time, cache, errors) + tách `routes/public.ts`.
4. `crawl/` (fetcher, validate, publish, runner, scheduler) + wiring `scheduled`/`queue`.
5. `seed/sources.sql` cho world+fx; chạy một vòng crawl ở local; kiểm tra D1 + KV.
6. Hoàn thiện `/v1/prices/latest` (KV+ETag), `/history`, `/world/latest`.
7. Integration test; thêm CI job.
8. (Khi có nguồn trong nước hợp lệ) fixture + config + bật `sjc`.

Mỗi bước tự verify (typecheck + test) trước khi sang bước sau.

---

## 11. Rủi ro & cách xử lý

| Rủi ro | Xử lý |
|---|---|
| Parse HTML vượt 10ms CPU (Free) | Đo sớm ở bước 1; cần thì chuyển HTMLRewriter hoặc lên Workers Paid |
| Nguồn trong nước chặn IP datacenter / đổi HTML | Fixture test bắt lỗi trước; `source_health`/`crawl_runs` cảnh báo; giữ giá cũ |
| Queue ops chạm hạn Free | Chu kỳ ≥ 5 phút, ít nguồn; theo dõi; dự trù Paid |
| Điều khoản sử dụng nguồn | `terms_checked` phải =1 mới `enabled`; ưu tiên mua API nếu có |
| KV eventually consistent | Write-through + fallback D1; chấp nhận trễ ~giây cho giá tham khảo |

---

## 12. Câu cần bạn xác nhận trước khi code

1. **Nguồn trong nước cho Phase 1:** bạn muốn tôi thử nguồn nào (SJC? DOJI? PNJ?) hay cứ làm pipeline với world+fx trước, nguồn trong nước thêm sau khi có admin (Phase 2)?
2. **Tài nguyên remote:** tôi chuẩn bị lệnh tạo KV + Queue để bạn chạy (giống D1), hay bạn muốn tôi chỉ làm local trước, remote để sau?
3. **Chu kỳ crawl mặc định:** 5 phút ổn chứ?
