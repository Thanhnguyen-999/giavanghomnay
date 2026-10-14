import { Hono } from 'hono';
import { cors } from 'hono/cors';

type AppEnv = { Bindings: Env };

const app = new Hono<AppEnv>();

// Chỉ cho phép origin cấu hình trong CORS_ORIGINS (web công khai). Mobile không cần CORS.
app.use('/v1/*', async (c, next) => {
  const allowed = c.env.CORS_ORIGINS.split(',').map((o) => o.trim());
  return cors({ origin: (origin) => (allowed.includes(origin) ? origin : null) })(c, next);
});

// Kiểm tra Worker và kết nối D1.
app.get('/health', async (c) => {
  const row = await c.env.DB.prepare(
    "SELECT COUNT(*) AS tables FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '\\_%' ESCAPE '\\' AND name NOT LIKE 'sqlite%'",
  ).first<{ tables: number }>();
  return c.json({ data: { status: 'ok', d1_tables: row?.tables ?? 0 } });
});

app.get('/v1/brands', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, slug, name, logo_r2_key, sort_order FROM brands WHERE active = 1 ORDER BY sort_order, name',
  ).all();
  return c.json({ data: results });
});

app.get('/v1/products', async (c) => {
  const brand = c.req.query('brand');
  const sql = `SELECT id, brand_id, slug, name, kind, purity, region, sort_order
                 FROM products
                WHERE active = 1 ${brand ? 'AND brand_id = ?1' : ''}
                ORDER BY brand_id, sort_order, name`;
  const stmt = brand ? c.env.DB.prepare(sql).bind(brand) : c.env.DB.prepare(sql);
  const { results } = await stmt.all();
  return c.json({ data: results });
});

// Tạm đọc thẳng D1; KV snapshot + ETag thêm ở Phase 1 (architecture.md mục 10).
app.get('/v1/prices/latest', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT p.id AS product_id, p.brand_id, p.name, p.kind, p.region,
            l.buy, l.sell, l.prev_buy, l.prev_sell, l.changed_at, l.checked_at, l.source_id
       FROM latest_prices l
       JOIN products p ON p.id = l.product_id
       JOIN brands b   ON b.id = p.brand_id
      WHERE p.active = 1 AND b.active = 1
      ORDER BY b.sort_order, p.sort_order`,
  ).all();
  return c.json({ data: results, meta: { count: results.length } });
});

app.notFound((c) => c.json({ error: { code: 'not_found', message: 'Not found' } }, 404));

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: { code: 'internal', message: 'Internal error' } }, 500);
});

export default app;
