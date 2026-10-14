-- Migration 0001: schema khởi tạo cho gold-db.
-- Quy ước: giá = đồng/lượng (INTEGER); thời gian = unix giây UTC.
-- Tham chiếu: ai_docs/architecture.md mục 5.

-- ───────── Danh mục (quản lý từ admin) ─────────
CREATE TABLE brands (
  id          TEXT PRIMARY KEY,                -- 'sjc'
  slug        TEXT NOT NULL UNIQUE,            -- URL web: /gia-vang/sjc
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
  max_spread_pct REAL NOT NULL DEFAULT 10,     -- ngưỡng chênh mua/bán
  max_change_pct REAL NOT NULL DEFAULT 5,      -- ngưỡng biến động mỗi lần cập nhật
  sort_order     INTEGER NOT NULL DEFAULT 0,
  active         INTEGER NOT NULL DEFAULT 1,
  updated_at     INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (brand_id, slug)
);
CREATE INDEX idx_products_brand ON products (brand_id, sort_order);

-- ───────── Nguồn dữ liệu động ─────────
CREATE TABLE sources (
  id                    TEXT PRIMARY KEY,      -- 'sjc-web'
  name                  TEXT NOT NULL,
  kind                  TEXT NOT NULL CHECK (kind IN ('domestic', 'world', 'fx')),
  enabled               INTEGER NOT NULL DEFAULT 0,
  interval_sec          INTEGER NOT NULL DEFAULT 300 CHECK (interval_sec >= 60),
  active_config_version INTEGER,               -- NULL = chưa có cấu hình chạy được
  next_run_at           INTEGER NOT NULL DEFAULT 0,
  terms_checked         INTEGER NOT NULL DEFAULT 0,
  note                  TEXT,
  updated_at            INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_sources_due ON sources (enabled, next_run_at);

-- Cấu hình bất biến: sửa = tạo version mới; rollback = đổi active_config_version.
CREATE TABLE source_configs (
  source_id  TEXT NOT NULL REFERENCES sources(id),
  version    INTEGER NOT NULL,
  config     TEXT NOT NULL CHECK (json_valid(config)),
  note       TEXT,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (source_id, version)
);

-- Nhãn thô trong nguồn → sản phẩm. Nhãn mới tự thêm với status 'pending'.
CREATE TABLE source_mappings (
  source_id    TEXT NOT NULL REFERENCES sources(id),
  raw_key      TEXT NOT NULL,
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
  raw_r2_key     TEXT
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
  reason      TEXT NOT NULL,
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
  email      TEXT PRIMARY KEY,                 -- khớp email trong Access JWT (chữ thường)
  role       TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  active     INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  actor       TEXT NOT NULL,                   -- email admin hoặc 'system'
  action      TEXT NOT NULL,                   -- 'source.config.create', ...
  entity      TEXT NOT NULL,
  entity_id   TEXT NOT NULL,
  before_json TEXT,                            -- tránh từ khóa SQLite BEFORE/AFTER
  after_json  TEXT,
  at          INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_audit_entity ON audit_log (entity, entity_id, at DESC);
