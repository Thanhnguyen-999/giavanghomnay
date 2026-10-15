-- Admin đầu tiên (owner). Copy thành admins.sql, điền email THẬT của bạn, rồi chạy:
--   npx wrangler d1 execute gold-db --remote --file=./seed/admins.sql
-- Email phải khớp email đăng nhập Cloudflare Access (chữ thường).
-- Sau đó owner thêm/bớt admin khác qua UI (/admin/v1/admins).

INSERT OR IGNORE INTO admins (email, role) VALUES ('ban@example.com', 'owner');
