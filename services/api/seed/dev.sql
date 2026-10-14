-- Dữ liệu mẫu CHỈ dùng cho môi trường local/dev. Không chạy trên production.
-- Thương hiệu, sản phẩm thật sẽ được tạo từ admin dashboard.
-- Chạy lại nhiều lần được (INSERT OR IGNORE).

INSERT OR IGNORE INTO brands (id, slug, name, sort_order) VALUES
  ('sjc',  'sjc',  'SJC',  1),
  ('doji', 'doji', 'DOJI', 2),
  ('pnj',  'pnj',  'PNJ',  3);

INSERT OR IGNORE INTO products (id, brand_id, slug, name, kind, purity, region, sort_order) VALUES
  ('sjc-bar-1l-hcm',  'sjc',  'mieng-1l-hcm',  'Vàng miếng SJC 1L - 10L', 'bar',  '9999', 'HCM', 1),
  ('sjc-ring-9999',   'sjc',  'nhan-9999',     'Nhẫn SJC 99,99%',         'ring', '9999', 'HCM', 2),
  ('doji-bar-hn',     'doji', 'mieng-sjc-hn',  'SJC - DOJI Hà Nội',       'bar',  '9999', 'HN',  1),
  ('pnj-ring-24k',    'pnj',  'nhan-24k',      'Nhẫn trơn PNJ 24K',       'ring', '9999', 'HCM', 1);

-- Giá mẫu (đồng/lượng) để test API; không phải giá thật.
INSERT OR IGNORE INTO latest_prices
  (product_id, buy, sell, prev_buy, prev_sell, changed_at, checked_at, source_id) VALUES
  ('sjc-bar-1l-hcm', 128000000, 130000000, 127500000, 129500000, unixepoch(), unixepoch(), 'manual'),
  ('sjc-ring-9999',  125000000, 127500000, NULL,      NULL,      unixepoch(), unixepoch(), 'manual'),
  ('doji-bar-hn',    128000000, 130000000, 128000000, 130000000, unixepoch(), unixepoch(), 'manual'),
  ('pnj-ring-24k',   125200000, 127700000, 125500000, 128000000, unixepoch(), unixepoch(), 'manual');
