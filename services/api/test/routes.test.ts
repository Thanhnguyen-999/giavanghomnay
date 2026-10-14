import { env, applyD1Migrations } from 'cloudflare:test';
import { beforeAll, describe, expect, test } from 'vitest';
import app from '../src/index.ts';

// Áp migrations vào D1 test một lần, rồi chèn dữ liệu tối thiểu.
beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);

  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO brands (id, slug, name, sort_order) VALUES ('sjc', 'sjc', 'SJC', 1)",
    ),
    env.DB.prepare(
      `INSERT INTO products (id, brand_id, slug, name, kind, purity, region, sort_order)
       VALUES ('sjc-bar', 'sjc', 'mieng', 'Vàng miếng SJC', 'bar', '9999', 'HCM', 1)`,
    ),
    env.DB.prepare(
      `INSERT INTO latest_prices (product_id, buy, sell, changed_at, checked_at, source_id)
       VALUES ('sjc-bar', 128000000, 130000000, 1000, 1000, 'manual')`,
    ),
    env.DB.prepare(
      "INSERT INTO world_ticks (symbol, recorded_at, price_usd, usd_vnd) VALUES ('XAU', 2000, 4100.5, 25000)",
    ),
  ]);
});

function req(path: string, headers?: Record<string, string>): Request {
  return new Request(`https://api.test${path}`, { headers });
}

describe('routes', () => {
  test('GET /health → ok + đếm bảng', async () => {
    const res = await app.fetch(req('/health'), env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { status: string; d1_tables: number } };
    expect(body.data.status).toBe('ok');
    expect(body.data.d1_tables).toBeGreaterThan(10);
  });

  test('GET /v1/brands → trả SJC', async () => {
    const res = await app.fetch(req('/v1/brands'), env);
    const body = (await res.json()) as { data: { id: string }[] };
    expect(body.data).toHaveLength(1);
    expect(body.data[0]?.id).toBe('sjc');
  });

  test('GET /v1/prices/latest → có ETag và dữ liệu', async () => {
    const res = await app.fetch(req('/v1/prices/latest'), env);
    expect(res.status).toBe(200);
    expect(res.headers.get('ETag')).toBeTruthy();
    const body = (await res.json()) as { data: { product_id: string }[] };
    expect(body.data[0]?.product_id).toBe('sjc-bar');
  });

  test('GET /v1/prices/latest với If-None-Match khớp → 304', async () => {
    const first = await app.fetch(req('/v1/prices/latest'), env);
    const etag = first.headers.get('ETag')!;
    const second = await app.fetch(req('/v1/prices/latest', { 'If-None-Match': etag }), env);
    expect(second.status).toBe(304);
  });

  test('GET /v1/prices/:id/history range sai → 400', async () => {
    const res = await app.fetch(req('/v1/prices/sjc-bar/history?range=zzz'), env);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('invalid_input');
  });

  test('GET /v1/prices/:id/history sản phẩm không tồn tại → 404', async () => {
    const res = await app.fetch(req('/v1/prices/khong-co/history?range=1m'), env);
    expect(res.status).toBe(404);
  });

  test('GET /v1/world/latest → trả XAU', async () => {
    const res = await app.fetch(req('/v1/world/latest'), env);
    const body = (await res.json()) as { data: { symbol: string }[] };
    expect(body.data[0]?.symbol).toBe('XAU');
  });
});
