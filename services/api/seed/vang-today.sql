-- Nguồn giá vàng trong nước vang.today + thương hiệu/sản phẩm/mapping tương ứng.
-- API: https://www.vang.today/api/prices  (object `prices`, key = type_code, VND/lượng).
--
-- CÁCH CHẠY (chạy từng phần theo thứ tự để tránh lỗi FK nếu DB đã có dữ liệu cũ
-- trùng slug; trên DB sạch chạy cả file cũng được):
--   npx wrangler d1 execute gold-db --remote --file=./seed/vang-today.sql
-- Chạy lại an toàn (INSERT OR IGNORE).
--
-- Lưu ý: nguồn tạo với enabled=0, terms_checked=0. Chỉ bật sau khi đã kiểm tra
-- điều khoản sử dụng của vang.today (qua dashboard hoặc PATCH /admin/v1/sources).

-- ───────── 1. Thương hiệu ─────────
INSERT OR IGNORE INTO brands (id, slug, name, sort_order) VALUES
  ('sjc',     'sjc',     'SJC',               1),
  ('doji',    'doji',    'DOJI',              2),
  ('pnj',     'pnj',     'PNJ',               3),
  ('btmc',    'btmc',    'Bảo Tín Minh Châu', 4),
  ('viettin', 'viettin', 'Viettin',           5),
  ('vngold',  'vngold',  'VN Gold',           6);

-- ───────── 2. Sản phẩm (mỗi type_code vang.today = 1 sản phẩm) ─────────
-- slug đặt riêng để không đụng sản phẩm có sẵn.
INSERT OR IGNORE INTO products (id, brand_id, slug, name, kind, purity, region, sort_order) VALUES
  ('sjc-mieng',   'sjc',     'vt-mieng-1l',  'Vàng miếng SJC 1L-10L', 'bar',     '9999', NULL,  1),
  ('sjc-nhan',    'sjc',     'vt-nhan-9999', 'Nhẫn SJC 99,99%',       'ring',    '9999', NULL,  2),
  ('doji-hn',     'doji',    'vt-hn',        'DOJI Hà Nội',           'bar',     '9999', 'HN',  1),
  ('doji-hcm',    'doji',    'vt-hcm',       'DOJI TP.HCM',           'bar',     '9999', 'HCM', 2),
  ('doji-nhan',   'doji',    'vt-nhan',      'DOJI Nữ trang',         'jewelry', '9999', NULL,  3),
  ('pnj-24k',     'pnj',     'vt-24k',       'Vàng PNJ 24K',          'ring',    '9999', NULL,  1),
  ('pnj-hn',      'pnj',     'vt-hn',        'PNJ Hà Nội',            'bar',     '9999', 'HN',  2),
  ('btmc-sjc',    'btmc',    'vt-sjc',       'Bảo Tín SJC',           'bar',     '9999', NULL,  1),
  ('btmc-9999',   'btmc',    'vt-9999',      'Bảo Tín 9999',          'ring',    '9999', NULL,  2),
  ('viettin-sjc', 'viettin', 'vt-sjc',       'Viettin SJC',           'bar',     '9999', NULL,  1),
  ('vngold-sjc',  'vngold',  'vt-sjc',       'VN Gold SJC',           'bar',     '9999', NULL,  1);

-- ───────── 3. Nguồn + cấu hình ─────────
INSERT OR IGNORE INTO sources (id, name, kind, enabled, interval_sec, terms_checked, note) VALUES
  ('vang-today', 'Giá vàng trong nước (vang.today)', 'domestic', 0, 300, 0,
   'https://www.vang.today/api/prices — kiểm tra điều khoản trước khi bật');

-- Cấu hình: object `prices`, wildcard duyệt theo key (type_code → $key làm nhãn).
-- Giá đã là VND/lượng nên multiplier=1.
INSERT OR IGNORE INTO source_configs (source_id, version, config, note, created_by) VALUES
  ('vang-today', 1, json('{"request":{"url":"https://www.vang.today/api/prices"},"format":"json","rows":"prices[*]","fields":{"label":{"path":"$key"},"buy":{"path":"buy"},"sell":{"path":"sell"}},"number":{"thousandSeparator":".","decimalSeparator":",","multiplier":1},"keyTemplate":"{label}"}'), 'v1 seed', 'system');

UPDATE sources SET active_config_version = 1 WHERE id = 'vang-today';

-- ───────── 4. Mapping type_code → sản phẩm ─────────
-- raw_key = chuẩn hóa của {label} = type_code viết thường.
-- xauusd là giá vàng thế giới (USD) → bỏ qua (ignored), không thuộc bảng VND/lượng.
INSERT OR IGNORE INTO source_mappings (source_id, raw_key, product_id, status, last_seen_at) VALUES
  ('vang-today', 'sjl1l10',    'sjc-mieng',   'mapped',  unixepoch()),
  ('vang-today', 'sj9999',     'sjc-nhan',    'mapped',  unixepoch()),
  ('vang-today', 'dohnl',      'doji-hn',     'mapped',  unixepoch()),
  ('vang-today', 'dohcml',     'doji-hcm',    'mapped',  unixepoch()),
  ('vang-today', 'dojinhtv',   'doji-nhan',   'mapped',  unixepoch()),
  ('vang-today', 'pqhn24ntt',  'pnj-24k',     'mapped',  unixepoch()),
  ('vang-today', 'pqhnvm',     'pnj-hn',      'mapped',  unixepoch()),
  ('vang-today', 'btsjc',      'btmc-sjc',    'mapped',  unixepoch()),
  ('vang-today', 'bt9999ntt',  'btmc-9999',   'mapped',  unixepoch()),
  ('vang-today', 'viettinmsjc','viettin-sjc', 'mapped',  unixepoch()),
  ('vang-today', 'vngsjc',     'vngold-sjc',  'mapped',  unixepoch()),
  ('vang-today', 'xauusd',     NULL,          'ignored', unixepoch());
