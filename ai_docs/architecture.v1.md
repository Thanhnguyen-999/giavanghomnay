# Ứng dụng Mobile theo dõi giá vàng — Flutter + Cloudflare

## I. Tổng quan kiến trúc

```
┌─────────────────────────────────────────────────────────────┐
│                    FLUTTER MOBILE APP                       │
│  (Android / iOS)                                            │
│  Riverpod • Dio • fl_chart • Hive • FCM                     │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS / WebSocket
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   CLOUDFLARE EDGE                           │
│                                                             │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐     │
│  │   Workers    │   │  Durable     │   │   Queues     │     │
│  │  (REST API)  │◄──│  Objects     │◄──│  (async job) │     │
│  └──────┬───────┘   │  (realtime)  │   └──────┬───────┘     │
│         │           └──────────────┘          │             │
│         │                                     │             │
│  ┌──────▼───────┐   ┌──────────────┐   ┌──────▼───────┐     │
│  │  D1 (SQLite) │   │  KV (cache)  │   │  R2 (assets) │     │
│  │  lịch sử giá │   │  giá latest  │   │  ảnh/tin tức │     │
│  └──────────────┘   └──────────────┘   └──────────────┘     │
│                                                             │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐     │
│  │ Cron Triggers│   │  Pages       │   │  Analytics   │     │
│  │  (crawler)   │   │  (admin web) │   │  Engine      │     │
│  └──────────────┘   └──────────────┘   └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────────┐
        │  Nguồn dữ liệu bên ngoài:            │
        │  SJC, DOJI, PNJ, BTMC, Kitco, ...    │
        └──────────────────────────────────────┘
```

---

## II. Cloudflare Stack chi tiết

| Thành phần | Vai trò | Ghi chú |
|---|---|---|
| **Cloudflare Workers** | REST API, business logic | Runtime V8, không cần server |
| **D1** | Database SQLite (lịch sử giá, users, alerts) | Serverless SQL, miễn phí 5GB |
| **KV** | Cache giá latest, config, session | Đọc nhanh, TTL linh hoạt |
| **R2** | Lưu ảnh tin tức, logo thương hiệu, backup | S3-compatible, không phí egress |
| **Durable Objects** | Realtime WebSocket, coordination | 1 object = 1 "room" thương hiệu |
| **Queues** | Xử lý bất đồng bộ (crawl, notify) | Retry tự động, batch |
| **Cron Triggers** | Crawl giá mỗi 1–5 phút | Chạy theo lịch |
| **Workers AI** *(tùy chọn)* | Tóm tắt tin tức, sentiment | Miễn phí tier đầu |
| **Pages** | Trang admin (dashboard quản trị) | Deploy tĩnh + Functions |
| **Firebase (ngoài CF)** | Chỉ dùng FCM cho push notification | CF không có push service |

---

## III. Cấu trúc thư mục Monorepo đề xuất

```
gold-price-app/
├── apps/
│   ├── mobile/                    # Flutter app
│   │   ├── lib/
│   │   │   ├── main.dart
│   │   │   ├── app.dart
│   │   │   ├── core/
│   │   │   │   ├── constants/
│   │   │   │   ├── theme/
│   │   │   │   ├── network/       # DioClient
│   │   │   │   ├── errors/
│   │   │   │   └── utils/
│   │   │   ├── data/
│   │   │   │   ├── models/
│   │   │   │   ├── datasources/
│   │   │   │   │   ├── remote/
│   │   │   │   │   └── local/
│   │   │   │   └── repositories/
│   │   │   ├── domain/
│   │   │   │   └── usecases/
│   │   │   ├── presentation/
│   │   │   │   ├── providers/
│   │   │   │   ├── pages/
│   │   │   │   └── widgets/
│   │   │   └── services/
│   │   │       ├── notification_service.dart
│   │   │       └── background_service.dart
│   │   └── pubspec.yaml
│   │
│   └── admin/                     # Cloudflare Pages (dashboard)
│       └── (React / Vue / Svelte)
│
├── workers/                       # Cloudflare Workers
│   ├── api/                       # REST API chính
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── routes/
│   │   │   ├── handlers/
│   │   │   └── middleware/
│   │   ├── wrangler.toml
│   │   └── package.json
│   │
│   ├── crawler/                   # Cron crawl giá
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── sources/           # sjc.ts, doji.ts, pnj.ts...
│   │   │   └── parsers/
│   │   ├── wrangler.toml
│   │   └── package.json
│   │
│   ├── realtime/                  # Durable Objects WebSocket
│   │   ├── src/
│   │   │   └── price-room.ts
│   │   ├── wrangler.toml
│   │   └── package.json
│   │
│   └── notifier/                  # Queue consumer → FCM
│       ├── src/
│       │   └── index.ts
│       ├── wrangler.toml
│       └── package.json
│
├── packages/
│   └── shared/                    # Types, schema dùng chung
│       ├── src/
│       │   ├── types.ts
│       │   └── schemas.ts
│       └── package.json
│
├── migrations/                    # D1 migrations
│   ├── 0001_init.sql
│   ├── 0002_add_alerts.sql
│   └── ...
│
└── README.md
```

---

## IV. Schema Database (Cloudflare D1)

```sql
-- 0001_init.sql

-- Bảng thương hiệu vàng
CREATE TABLE brands (
  id TEXT PRIMARY KEY,              -- 'sjc', 'doji_hn', ...
  name TEXT NOT NULL,               -- 'SJC', 'DOJI Hà Nội'
  logo_url TEXT,
  sort_order INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Bảng giá vàng (lịch sử, ghi theo timestamp)
CREATE TABLE gold_prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand_id TEXT NOT NULL,
  buy_price INTEGER NOT NULL,       -- đơn vị: nghìn đồng/lượng
  sell_price INTEGER NOT NULL,
  recorded_at INTEGER NOT NULL,     -- unix timestamp (giây)
  source TEXT,                      -- 'sjc.com.vn', 'doji.vn', ...
  FOREIGN KEY (brand_id) REFERENCES brands(id)
);

CREATE INDEX idx_gold_prices_brand_time
  ON gold_prices (brand_id, recorded_at DESC);

-- Bảng giá vàng thế giới
CREATE TABLE world_prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,             -- 'XAUUSD'
  price REAL NOT NULL,              -- USD/oz
  change REAL,
  recorded_at INTEGER NOT NULL
);

CREATE INDEX idx_world_prices_time ON world_prices (recorded_at DESC);

-- Bảng tin tức
CREATE TABLE news (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  summary TEXT,
  content TEXT,
  thumbnail_url TEXT,
  source_url TEXT UNIQUE NOT NULL,
  category TEXT,                    -- 'domestic','world','analysis'
  published_at INTEGER NOT NULL,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX idx_news_published ON news (published_at DESC);
CREATE INDEX idx_news_category ON news (category, published_at DESC);

-- Người dùng (ẩn danh qua device_id, hoặc Firebase UID)
CREATE TABLE users (
  id TEXT PRIMARY KEY,              -- Firebase UID
  fcm_token TEXT,
  platform TEXT,                    -- 'android','ios'
  language TEXT DEFAULT 'vi',
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Cảnh báo giá
CREATE TABLE price_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  brand_id TEXT NOT NULL,
  alert_type TEXT NOT NULL,         -- 'above','below','change_percent'
  threshold REAL NOT NULL,
  active INTEGER DEFAULT 1,
  last_triggered_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (brand_id) REFERENCES brands(id)
);

CREATE INDEX idx_alerts_user ON price_alerts (user_id, active);
CREATE INDEX idx_alerts_brand ON price_alerts (brand_id, active);

-- Favorites (thương hiệu yêu thích của user)
CREATE TABLE favorites (
  user_id TEXT NOT NULL,
  brand_id TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  PRIMARY KEY (user_id, brand_id)
);
```

---

## V. Cloudflare Workers — wrangler.toml mẫu

### 1. API Worker

```toml
# workers/api/wrangler.toml
name = "gold-api"
main = "src/index.ts"
compatibility_date = "2024-09-23"
node_compat = true

[vars]
ENV = "production"

[[d1_databases]]
binding = "DB"
database_name = "gold-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

[[kv_namespaces]]
binding = "CACHE"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

[[r2_buckets]]
binding = "ASSETS"
bucket_name = "gold-assets"

[[durable_objects.bindings]]
name = "PRICE_ROOM"
class_name = "PriceRoom"

[[migrations]]
tag = "v1"
new_classes = ["PriceRoom"]

[observability]
enabled = true
```

### 2. Crawler Worker (Cron)

```toml
# workers/crawler/wrangler.toml
name = "gold-crawler"
main = "src/index.ts"
compatibility_date = "2024-09-23"

[[d1_databases]]
binding = "DB"
database_name = "gold-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

[[kv_namespaces]]
binding = "CACHE"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

[[queues.producers]]
binding = "NOTIFY_QUEUE"
queue = "price-notifications"

# Chạy mỗi 5 phút
[triggers]
crons = ["*/5 * * * *"]
```

### 3. Notifier Worker (Queue consumer)

```toml
# workers/notifier/wrangler.toml
name = "gold-notifier"
main = "src/index.ts"
compatibility_date = "2024-09-23"

[[d1_databases]]
binding = "DB"
database_name = "gold-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

[[queues.consumers]]
queue = "price-notifications"
max_batch_size = 10
max_batch_timeout = 30
max_retries = 3
dead_letter_queue = "price-notifications-dlq"

[vars]
FCM_SERVER_KEY = "" # dùng secret: wrangler secret put FCM_SERVICE_ACCOUNT
```

---

## VI. Code mẫu Cloudflare Workers

### 1. API — endpoint lấy giá mới nhất

```typescript
// workers/api/src/index.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Env = {
  DB: D1Database;
  CACHE: KVNamespace;
  ASSETS: R2Bucket;
  PRICE_ROOM: DurableObjectNamespace;
};

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors());

// GET /api/prices/latest
app.get('/api/prices/latest', async (c) => {
  const cached = await c.env.CACHE.get('prices:latest', 'json');
  if (cached) {
    return c.json({ data: cached, cached: true });
  }

  const { results } = await c.env.DB.prepare(`
    SELECT b.id, b.name, b.logo_url,
           p.buy_price, p.sell_price, p.recorded_at
    FROM brands b
    JOIN gold_prices p ON p.id = (
      SELECT id FROM gold_prices
      WHERE brand_id = b.id
      ORDER BY recorded_at DESC LIMIT 1
    )
    WHERE b.active = 1
    ORDER BY b.sort_order
  `).all();

  await c.env.CACHE.put('prices:latest', JSON.stringify(results), {
    expirationTtl: 60,
  });

  return c.json({ data: results, cached: false });
});

// GET /api/prices/history?brand=sjc&range=30d
app.get('/api/prices/history', async (c) => {
  const brand = c.req.query('brand') ?? 'sjc';
  const range = c.req.query('range') ?? '30d';

  const seconds = parseRange(range);
  const since = Math.floor(Date.now() / 1000) - seconds;

  const { results } = await c.env.DB.prepare(`
    SELECT buy_price, sell_price, recorded_at
    FROM gold_prices
    WHERE brand_id = ? AND recorded_at >= ?
    ORDER BY recorded_at ASC
  `).bind(brand, since).all();

  return c.json({ data: results });
});

// POST /api/alerts (đăng ký cảnh báo)
app.post('/api/alerts', async (c) => {
  const body = await c.req.json();
  await c.env.DB.prepare(`
    INSERT INTO price_alerts (user_id, brand_id, alert_type, threshold)
    VALUES (?, ?, ?, ?)
  `).bind(body.userId, body.brandId, body.alertType, body.threshold).run();
  return c.json({ ok: true });
});

function parseRange(range: string): number {
  const map: Record<string, number> = {
    '1d': 86400, '1w': 604800, '1m': 2592000,
    '3m': 7776000, '6m': 15552000, '1y': 31536000,
  };
  return map[range] ?? 2592000;
}

export default app;
```

### 2. Crawler Worker (Cron)

```typescript
// workers/crawler/src/index.ts
export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(crawlAll(env));
  },
};

async function crawlAll(env: Env) {
  const sources = [
    { id: 'sjc', fn: crawlSJC },
    { id: 'doji_hn', fn: crawlDOJI_HN },
    { id: 'doji_sg', fn: crawlDOJI_SG },
    { id: 'pnj_hcm', fn: crawlPNJ_HCM },
    { id: 'pnj_hn', fn: crawlPNJ_HN },
    { id: 'btmc_vrtl', fn: crawlBTMC_VRTL },
  ];

  const now = Math.floor(Date.now() / 1000);
  const statements = [];

  for (const src of sources) {
    try {
      const price = await src.fn();
      statements.push(
        env.DB.prepare(`
          INSERT INTO gold_prices (brand_id, buy_price, sell_price, recorded_at, source)
          VALUES (?, ?, ?, ?, ?)
        `).bind(src.id, price.buy, price.sell, now, price.source)
      );
    } catch (e) {
      console.error(`Crawl ${src.id} failed`, e);
    }
  }

  if (statements.length) {
    await env.DB.batch(statements);
  }

  // Invalidate cache
  await env.CACHE.delete('prices:latest');

  // Đẩy job check alert
  await env.NOTIFY_QUEUE.send({ type: 'check_alerts', at: now });
}

async function crawlSJC() {
  const res = await fetch('https://sjc.com.vn/giavang/textContent.php');
  const html = await res.text();
  // Parse HTML để lấy giá mua/bán (nghìn đồng/lượng)
  const buy = parseBuy(html);
  const sell = parseSell(html);
  return { buy, sell, source: 'sjc.com.vn' };
}
```

### 3. Durable Object — Realtime WebSocket

```typescript
// workers/realtime/src/price-room.ts
export class PriceRoom implements DurableObject {
  state: DurableObjectState;
  sessions: Set<WebSocket> = new Set();

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request) {
    const upgrade = request.headers.get('Upgrade');
    if (upgrade !== 'websocket') {
      return new Response('Expected websocket', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.state.acceptWebSocket(server);
    this.sessions.add(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  // Gọi từ crawler sau khi có giá mới
  async broadcast(payload: object) {
    const msg = JSON.stringify(payload);
    for (const ws of this.state.getWebSockets()) {
      try { ws.send(msg); } catch {}
    }
  }
}
```

### 4. Notifier Worker — Queue consumer

```typescript
// workers/notifier/src/index.ts
export default {
  async queue(batch: MessageBatch, env: Env) {
    for (const msg of batch.messages) {
      if (msg.body.type === 'check_alerts') {
        await checkAlerts(env);
      }
      msg.ack();
    }
  },
};

async function checkAlerts(env: Env) {
  // Lấy giá mới nhất
  const { results: prices } = await env.DB.prepare(`
    SELECT b.id AS brand_id, p.buy_price, p.sell_price
    FROM brands b
    JOIN gold_prices p ON p.id = (
      SELECT id FROM gold_prices
      WHERE brand_id = b.id ORDER BY recorded_at DESC LIMIT 1
    )
  `).all();

  const priceMap = Object.fromEntries(
    prices.map((p: any) => [p.brand_id, p])
  );

  // Lấy alerts đang active
  const { results: alerts } = await env.DB.prepare(`
    SELECT a.*, u.fcm_token
    FROM price_alerts a
    JOIN users u ON u.id = a.user_id
    WHERE a.active = 1
  `).all();

  for (const alert of alerts as any[]) {
    const price = priceMap[alert.brand_id];
    if (!price) continue;

    let shouldTrigger = false;
    if (alert.alert_type === 'above' && price.sell_price > alert.threshold) shouldTrigger = true;
    if (alert.alert_type === 'below' && price.sell_price < alert.threshold) shouldTrigger = true;

    if (shouldTrigger && alert.fcm_token) {
      await sendFCM(env, alert.fcm_token, {
        title: `Giá ${alert.brand_id.toUpperCase()} vượt ngưỡng`,
        body: `Giá bán hiện tại: ${price.sell_price} nghìn đ/lượng`,
      });
    }
  }
}

async function sendFCM(env: Env, token: string, payload: object) {
  const accessToken = await getGoogleAccessToken(env);
  await fetch(
    `https://fcm.googleapis.com/v1/projects/${env.FCM_PROJECT_ID}/messages:send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: { token, notification: payload },
      }),
    }
  );
}
```

---

## VII. Packages & Tools cho Cloudflare

```json
// workers/api/package.json
{
  "name": "gold-api",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "db:migrate": "wrangler d1 migrations apply gold-db",
    "db:migrate:local": "wrangler d1 migrations apply gold-db --local",
    "tail": "wrangler tail"
  },
  "dependencies": {
    "hono": "^4.5.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20240909.0",
    "typescript": "^5.5.4",
    "wrangler": "^3.75.0"
  }
}
```

---

## VIII. Flutter App — Điều chỉnh kết nối Cloudflare

### 1. pubspec.yaml (bổ sung)

```yaml
dependencies:
  # ... (giữ nguyên từ phần trước)
  web_socket_channel: ^3.0.0    # kết nối Durable Objects
  firebase_core: ^3.1.0          # FCM
  firebase_messaging: ^15.0.2
```

### 2. Cấu hình API endpoint

```dart
// lib/core/constants/api.dart
class ApiConfig {
  // Endpoint Cloudflare Workers
  static const String baseUrl = 'https://gold-api.<subdomain>.workers.dev';
  static const String wsUrl = 'wss://gold-realtime.<subdomain>.workers.dev';

  // Hoặc custom domain (khuyến nghị cho production)
  // static const String baseUrl = 'https://api.giavang.example.com';
}
```

### 3. DioClient với interceptor

```dart
// lib/core/network/dio_client.dart
import 'package:dio/dio.dart';
import 'package:hive_flutter/hive_flutter.dart';

class DioClient {
  late final Dio dio;
  final Box cacheBox;

  DioClient(this.cacheBox) {
    dio = Dio(BaseOptions(
      baseUrl: ApiConfig.baseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 15),
      headers: {'Accept': 'application/json'},
    ));

    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) {
        // Cache-first cho GET
        if (options.method == 'GET') {
          final key = 'cache:${options.path}?${options.queryParameters}';
          final cached = cacheBox.get(key);
          if (cached != null) {
            // Trả cache nhanh, vẫn tiếp tục gọi API
            // (dùng cho stale-while-revalidate)
          }
        }
        handler.next(options);
      },
      onResponse: (response, handler) {
        if (response.requestOptions.method == 'GET') {
          final key = 'cache:${response.requestOptions.path}'
              '?${response.requestOptions.queryParameters}';
          cacheBox.put(key, response.data);
        }
        handler.next(response);
      },
      onError: (e, handler) {
        // Fallback cache khi lỗi mạng
        handler.next(e);
      },
    ));
  }
}
```

### 4. WebSocket realtime qua Durable Objects

```dart
// lib/services/realtime_service.dart
import 'package:web_socket_channel/web_socket_channel.dart';
import 'dart:convert';

class RealtimeService {
  WebSocketChannel? _channel;
  final _controller = StreamController<Map<String, dynamic>>.broadcast();

  Stream<Map<String, dynamic>> get prices => _controller.stream;

  void connect() {
    _channel = WebSocketChannel.connect(Uri.parse(ApiConfig.wsUrl));
    _channel!.stream.listen(
      (data) {
        _controller.add(jsonDecode(data));
      },
      onError: (e) => _reconnect(),
      onDone: () => _reconnect(),
    );
  }

  void _reconnect() {
    Future.delayed(const Duration(seconds: 3), connect);
  }

  void dispose() {
    _channel?.sink.close();
    _controller.close();
  }
}
```

---

## IX. Roadmap triển khai (Cloudflare + Flutter)

### Phase 1 — Nền tảng (1 tuần)
- [ ] Setup Cloudflare account, cài `wrangler`
- [ ] Tạo D1 database + chạy migrations
- [ ] Tạo KV namespace + R2 bucket
- [ ] Deploy Worker `api` đầu tiên (endpoint `/health`)
- [ ] Setup Flutter project + clean architecture

### Phase 2 — Crawler & API (1 tuần)
- [ ] Viết crawler cho SJC, DOJI, PNJ
- [ ] Cron Trigger mỗi 5 phút
- [ ] API endpoints: `/prices/latest`, `/prices/history`
- [ ] Test với `wrangler tail`

### Phase 3 — Mobile MVP (1–2 tuần)
- [ ] Bảng giá vàng + pull-to-refresh
- [ ] Cache local Hive + offline mode
- [ ] Biểu đồ fl_chart
- [ ] Tab tin tức + WebView

### Phase 4 — Realtime & Alert (1 tuần)
- [ ] Durable Object WebSocket
- [ ] Mobile lắng nghe realtime
- [ ] Queue + FCM push notification
- [ ] Cảnh báo ngưỡng giá

### Phase 5 — Polish & Release (1 tuần)
- [ ] Dark mode, settings
- [ ] Analytics, Crashlytics
- [ ] Test coverage > 60%
- [ ] Submit Google Play + App Store

---

## X. Prompt hoàn chỉnh để build toàn bộ hệ thống

```
Xây dựng hệ thống theo dõi giá vàng Việt Nam gồm 2 phần:
(1) Backend trên Cloudflare, (2) Mobile app Flutter.

## PHẦN 1: BACKEND — CLOUDFLARE STACK

### Kiến trúc
- Cloudflare Workers (API REST) + Hono framework
- D1 (SQLite) lưu lịch sử giá, users, alerts
- KV cache giá latest (TTL 60s)
- R2 lưu ảnh tin tức
- Durable Objects cho WebSocket realtime
- Queues cho xử lý bất đồng bộ (crawl, notify)
- Cron Triggers crawl giá mỗi 5 phút
- Pages deploy admin dashboard

### Schema D1
- brands (id, name, logo_url, sort_order, active)
- gold_prices (brand_id, buy_price, sell_price, recorded_at)
- world_prices (symbol, price, change, recorded_at)
- news (title, summary, content, thumbnail_url, source_url, category, published_at)
- users (id, fcm_token, platform, language)
- price_alerts (user_id, brand_id, alert_type, threshold, active)
- favorites (user_id, brand_id, sort_order)

### API endpoints
- GET /api/prices/latest  → giá mới nhất tất cả thương hiệu (cache KV)
- GET /api/prices/history?brand=sjc&range=30d
- GET /api/world/latest
- GET /api/news?category=...&page=1
- GET /api/news/:id
- POST /api/users/register  → đăng ký FCM token
- POST /api/alerts  → tạo cảnh báo
- DELETE /api/alerts/:id
- GET /api/favorites, POST /api/favorites
- WS /realtime  → Durable Object broadcast giá realtime

### Crawler Workers
- Crawl từ: sjc.com.vn, doji.vn, pnj.com.vn, btmc.vn
- Parse HTML với HTMLRewriter (native Cloudflare)
- Insert batch vào D1
- Invalidate KV cache
- Push job vào Queue để check alerts

### Notifier Worker
- Consume Queue
- Query alerts active + giá mới nhất
- Nếu vượt ngưỡng → gửi FCM qua HTTP v1 API
- Đánh dấu last_triggered_at

### Bảo mật & vận hành
- Secrets: wrangler secret put FCM_SERVICE_ACCOUNT
- Rate limiting: Cloudflare Rate Limiting Rules
- CORS: chỉ cho phép domain mobile (nếu có)
- Logging: wrangler tail + Logpush
- Analytics: Cloudflare Analytics Engine

## PHẦN 2: MOBILE — FLUTTER

### Tech stack
- Flutter 3.x, Dart 3.x
- Riverpod (state), Dio (HTTP), Hive (local cache)
- fl_chart (biểu đồ), web_socket_channel (realtime)
- Firebase Messaging (FCM push)
- workmanager (background tasks)
- google_fonts, cached_network_image, shimmer

### Kiến trúc
- Clean Architecture: data / domain / presentation
- Freezed + json_serializable + retrofit
- Cấu trúc: core, data, domain, presentation, services

### Tính năng
1. Bottom nav 4 tab: Giá vàng | Biểu đồ | Tin tức | Cài đặt
2. Bảng giá đa thương hiệu (SJC, DOJI HN/SG, PNJ, BTMC, BTMH, Phú Quý)
   - Giá mua/bán + mũi tên tăng/giảm
   - Pull-to-refresh, auto-refresh 60s
   - Realtime qua WebSocket Durable Objects
3. Biểu đồ fl_chart
   - Line chart 30 ngày, chuyển khung 1D/1W/1M/3M/6M/1Y
   - Multi-line so sánh 2 thương hiệu
   - Pinch-to-zoom, tooltip
4. Tin tức
   - Danh sách card, infinite scroll
   - WebView chi tiết, share_plus
   - Cache 30 phút
5. Cảnh báo giá
   - Chọn thương hiệu + ngưỡng
   - Push notification qua FCM
   - Background check với workmanager
6. Cài đặt: dark mode, ngôn ngữ, thương hiệu yêu thích
7. Offline: cache Hive, banner "Đang offline", sync khi có mạng

### UI/UX
- Màu chủ đạo Gold #FFD700, tăng #00C853, giảm #D50000
- Font Roboto / Inter
- Card bo 12px, spacing bội số 8
- Loading shimmer, error retry, empty state
- Hero animation, AnimatedSwitcher cho giá

## DELIVERABLES
1. Source code Cloudflare Workers (api, crawler, notifier, realtime)
2. File wrangler.toml cho từng worker
3. Migrations D1 (.sql)
4. Source code Flutter hoàn chỉnh
5. README setup: wrangler, D1 migrations, deploy, build APK
6. Mock data để test offline
7. Unit test coverage > 60%
```

---

## XI. Lưu ý quan trọng với Cloudflare

| Vấn đề | Lưu ý |
|---|---|
| **D1 free tier** | 5GB, 5M reads/ngày, 100K writes/ngày — đủ cho MVP |
| **Workers free** | 100K requests/ngày, 10ms CPU/request — cần trả phí nếu nhiều |
| **Durable Objects** | Chỉ có ở gói trả phí ($5/tháng Workers Paid) |
| **Cron Triggers** | Tối thiểu 1 phút, không tính vào request quota |
| **R2** | Miễn phí 10GB storage, không phí egress |
| **KV** | Free 100K reads/ngày, 1K writes/ngày |
| **Queues** | Có ở Workers Paid, $0.40/triệu operations |
| **Crawl HTML** | Dùng `HTMLRewriter` (native) thay vì Cheerio để tiết kiệm CPU |
| **Subrequest limit** | 50 subrequest/request (free), 1000 (paid) — chia batch cẩn thận |
| **Firebase FCM** | Cloudflare không có push service → phải dùng FCM/APNs bên ngoài |

---

## XII. Chi phí ước tính (giai đoạn đầu)

| Dịch vụ | Free tier | Ước tính khi scale |
|---|---|---|
| Workers Paid | $5/tháng | $5 + $0.30/triệu request |
| D1 | Miễn phí | $0.75/triệu reads, $1/triệu writes |
| KV | Miễn phí | $0.50/triệu reads |
| R2 | Miễn phí 10GB | $0.015/GB/tháng |
| Durable Objects | Không có | $0.15/triệu requests + duration |
| Queues | Không có | $0.40/triệu ops |
| Firebase FCM | Miễn phí | Miễn phí |
| **Tổng MVP** | **~$5/tháng** | **~$20–50/tháng** ở 10K MAU |

---

**Ghi chú cuối**: Toàn bộ nội dung trên là markdown hoàn chỉnh, bạn có thể copy trực tiếp vào file `README.md` hoặc `docs/architecture.md` trong repo.