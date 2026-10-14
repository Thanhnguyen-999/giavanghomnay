-- Cấu hình nguồn dữ liệu vận hành (world + fx). KHÁC seed/dev.sql (chỉ local).
-- File này chạy được cả local lẫn remote. Chạy lại nhiều lần an toàn.
-- Nguồn trong nước (SJC/DOJI/PNJ) sẽ thêm từ admin dashboard ở Phase 2.
--
-- Lưu ý thứ tự: fx chạy trước để có tỷ giá USDVND; world đọc tỷ giá đó để quy đổi.
-- Cả hai cùng chu kỳ 300s; lượt world đầu nếu chưa có tỷ giá sẽ ghi usd_vnd=0,
-- lượt sau (sau khi fx đã chạy) sẽ đúng.

-- ───────── fx: tỷ giá USD→VND (open.er-api.com) ─────────
INSERT OR IGNORE INTO sources (id, name, kind, enabled, interval_sec, terms_checked, note)
VALUES ('fx-usd-vnd', 'Tỷ giá USD/VND (er-api)', 'fx', 1, 300, 1,
        'open.er-api.com, miễn phí, không cần key');

INSERT OR IGNORE INTO source_configs (source_id, version, config, note, created_by)
VALUES ('fx-usd-vnd', 1, json('{
  "request": { "url": "https://open.er-api.com/v6/latest/USD" },
  "format": "json",
  "rows": ".",
  "fields": { "label": { "path": "base_code" }, "price": { "path": "rates.VND" } },
  "number": { "thousandSeparator": ",", "decimalSeparator": ".", "multiplier": 1 },
  "keyTemplate": "{label}"
}'), 'v1 seed', 'system');

UPDATE sources SET active_config_version = 1 WHERE id = 'fx-usd-vnd';

-- ───────── world: giá vàng XAU (gold-api.com) ─────────
INSERT OR IGNORE INTO sources (id, name, kind, enabled, interval_sec, terms_checked, note)
VALUES ('world-xau', 'Vàng thế giới XAU (gold-api)', 'world', 1, 300, 1,
        'api.gold-api.com, miễn phí, không cần key');

INSERT OR IGNORE INTO source_configs (source_id, version, config, note, created_by)
VALUES ('world-xau', 1, json('{
  "request": { "url": "https://api.gold-api.com/price/XAU" },
  "format": "json",
  "rows": ".",
  "fields": { "label": { "path": "symbol" }, "price": { "path": "price" } },
  "number": { "thousandSeparator": ",", "decimalSeparator": ".", "multiplier": 1 },
  "keyTemplate": "{label}"
}'), 'v1 seed', 'system');

UPDATE sources SET active_config_version = 1 WHERE id = 'world-xau';

-- ───────── world: giá bạc XAG (gold-api.com) ─────────
INSERT OR IGNORE INTO sources (id, name, kind, enabled, interval_sec, terms_checked, note)
VALUES ('world-xag', 'Bạc thế giới XAG (gold-api)', 'world', 1, 300, 1,
        'api.gold-api.com, miễn phí, không cần key');

INSERT OR IGNORE INTO source_configs (source_id, version, config, note, created_by)
VALUES ('world-xag', 1, json('{
  "request": { "url": "https://api.gold-api.com/price/XAG" },
  "format": "json",
  "rows": ".",
  "fields": { "label": { "path": "symbol" }, "price": { "path": "price" } },
  "number": { "thousandSeparator": ",", "decimalSeparator": ".", "multiplier": 1 },
  "keyTemplate": "{label}"
}'), 'v1 seed', 'system');

UPDATE sources SET active_config_version = 1 WHERE id = 'world-xag';
