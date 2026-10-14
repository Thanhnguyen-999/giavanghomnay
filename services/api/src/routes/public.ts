import { Hono } from 'hono';
import {
  buildLatestFromD1,
  etagFor,
  readLatestSnapshot,
  refreshLatestSnapshot,
} from '../lib/cache.ts';
import { badRequest, notFound } from '../lib/errors.ts';
import { isHistoryRange, rangeSeconds, nowSec, usesTicks } from '../lib/time.ts';
import type { AppEnv } from '../types.ts';

export const publicRoutes = new Hono<AppEnv>();

publicRoutes.get('/brands', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, slug, name, logo_r2_key, sort_order FROM brands WHERE active = 1 ORDER BY sort_order, name',
  ).all();
  c.header('Cache-Control', 'public, max-age=300');
  return c.json({ data: results });
});

publicRoutes.get('/products', async (c) => {
  const brand = c.req.query('brand');
  const sql = `SELECT id, brand_id, slug, name, kind, purity, region, sort_order
                 FROM products
                WHERE active = 1 ${brand ? 'AND brand_id = ?1' : ''}
                ORDER BY brand_id, sort_order, name`;
  const stmt = brand ? c.env.DB.prepare(sql).bind(brand) : c.env.DB.prepare(sql);
  const { results } = await stmt.all();
  c.header('Cache-Control', 'public, max-age=300');
  return c.json({ data: results });
});

// Giá mới nhất: ưu tiên KV snapshot, miss thì dựng từ D1 và ghi lại. Có ETag/304.
publicRoutes.get('/prices/latest', async (c) => {
  let snapshot = await readLatestSnapshot(c.env);
  if (!snapshot) snapshot = await refreshLatestSnapshot(c.env);

  const etag = etagFor(snapshot);
  if (c.req.header('If-None-Match') === etag) {
    c.header('ETag', etag);
    c.header('Cache-Control', 'public, max-age=30');
    return c.body(null, 304);
  }

  c.header('ETag', etag);
  c.header('Cache-Control', 'public, max-age=30');
  return c.json({
    data: snapshot.items,
    meta: { updated_at: snapshot.updatedAt, count: snapshot.items.length },
  });
});

// Lịch sử giá: 1d/1w từ price_ticks; dài hơn từ price_daily.
publicRoutes.get('/prices/:productId/history', async (c) => {
  const productId = c.req.param('productId');
  const range = c.req.query('range') ?? '1m';
  if (!isHistoryRange(range)) {
    throw badRequest(`range không hợp lệ: ${range}`);
  }

  const product = await c.env.DB.prepare('SELECT id FROM products WHERE id = ? AND active = 1')
    .bind(productId)
    .first();
  if (!product) throw notFound('Không tìm thấy sản phẩm');

  const since = nowSec() - rangeSeconds(range);

  if (usesTicks(range)) {
    const { results } = await c.env.DB.prepare(
      `SELECT recorded_at, buy, sell FROM price_ticks
        WHERE product_id = ?1 AND recorded_at >= ?2
        ORDER BY recorded_at ASC`,
    )
      .bind(productId, since)
      .all();
    c.header('Cache-Control', 'public, max-age=60');
    return c.json({ data: results, meta: { product_id: productId, range, granularity: 'tick' } });
  }

  const sinceDay = new Date(since * 1000).toISOString().slice(0, 10);
  const { results } = await c.env.DB.prepare(
    `SELECT day, open_sell, high_sell, low_sell, close_sell, close_buy FROM price_daily
      WHERE product_id = ?1 AND day >= ?2
      ORDER BY day ASC`,
  )
    .bind(productId, sinceDay)
    .all();
  c.header('Cache-Control', 'public, max-age=60');
  return c.json({ data: results, meta: { product_id: productId, range, granularity: 'daily' } });
});

// Giá thế giới mới nhất (mỗi symbol lấy bản ghi gần nhất).
publicRoutes.get('/world/latest', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT w.symbol, w.price_usd, w.usd_vnd, w.recorded_at
       FROM world_ticks w
       JOIN (SELECT symbol, MAX(recorded_at) AS mx FROM world_ticks GROUP BY symbol) m
         ON m.symbol = w.symbol AND m.mx = w.recorded_at
      ORDER BY w.symbol`,
  ).all();
  c.header('Cache-Control', 'public, max-age=30');
  return c.json({ data: results, meta: { count: results.length } });
});

// Giữ import được dùng (buildLatestFromD1 sẽ dùng ở runner/tests).
void buildLatestFromD1;
