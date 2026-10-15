import { applyD1Migrations, env } from 'cloudflare:test';
import { beforeAll, describe, expect, test } from 'vitest';
import app from '../src/index.ts';

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
  await env.DB.prepare("INSERT INTO admins (email, role) VALUES ('editor@test', 'editor')").run();
});

function call(method: string, path: string, body?: unknown): Promise<Response> {
  return app.fetch(
    new Request(`https://api.test${path}`, {
      method,
      headers: {
        'X-Dev-Email': 'editor@test',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    }),
    env,
  );
}

// Mỗi test tự dựng brand + product (isolatedStorage rollback giữa các test).
async function seedProduct(id = 'sjc-bar') {
  await env.DB.batch([
    env.DB.prepare("INSERT OR IGNORE INTO brands (id, slug, name) VALUES ('sjc', 'sjc', 'SJC')"),
    env.DB.prepare(
      `INSERT INTO products (id, brand_id, slug, name, kind) VALUES (?1, 'sjc', ?1, ?1, 'bar')`,
    ).bind(id),
  ]);
}

describe('mappings', () => {
  test('gán nhãn pending → mapped, rồi nguồn khác map cùng product bị chặn', async () => {
    await seedProduct('sjc-bar');
    await env.DB.batch([
      env.DB.prepare("INSERT INTO sources (id, name, kind) VALUES ('s1', 's1', 'domestic')"),
      env.DB.prepare("INSERT INTO sources (id, name, kind) VALUES ('s2', 's2', 'domestic')"),
      env.DB.prepare(
        "INSERT INTO source_mappings (source_id, raw_key, status, last_seen_at) VALUES ('s1', 'vang sjc', 'pending', 1)",
      ),
      env.DB.prepare(
        "INSERT INTO source_mappings (source_id, raw_key, status, last_seen_at) VALUES ('s2', 'vang sjc 2', 'pending', 1)",
      ),
    ]);

    const ok = await call('PATCH', '/admin/v1/mappings/s1/vang%20sjc', {
      productId: 'sjc-bar',
      status: 'mapped',
    });
    expect(ok.status).toBe(200);

    const conflict = await call('PATCH', '/admin/v1/mappings/s2/vang%20sjc%202', {
      productId: 'sjc-bar',
      status: 'mapped',
    });
    expect(conflict.status).toBe(400); // uq_mapping_product
  });

  test('status=mapped thiếu productId → 400', async () => {
    await env.DB.prepare("INSERT INTO sources (id, name, kind) VALUES ('s3', 's3', 'domestic')").run();
    await env.DB.prepare(
      "INSERT INTO source_mappings (source_id, raw_key, status, last_seen_at) VALUES ('s3', 'x', 'pending', 1)",
    ).run();
    const res = await call('PATCH', '/admin/v1/mappings/s3/x', { productId: null, status: 'mapped' });
    expect(res.status).toBe(400);
  });
});

describe('reviews', () => {
  test('approve → publish vào latest_prices + review approved', async () => {
    await seedProduct('sjc-bar');
    await env.DB.prepare(
      `INSERT INTO price_reviews (id, product_id, source_id, buy, sell, reason, status, created_at)
       VALUES (1, 'sjc-bar', 'sjc-web', 128000000, 130000000, 'change_exceeded', 'pending', 1)`,
    ).run();

    const res = await call('POST', '/admin/v1/reviews/1/approve');
    expect(res.status).toBe(200);

    const latest = await env.DB.prepare('SELECT buy, sell FROM latest_prices WHERE product_id = ?')
      .bind('sjc-bar')
      .first<{ buy: number; sell: number }>();
    expect(latest).toEqual({ buy: 128000000, sell: 130000000 });

    const review = await env.DB.prepare('SELECT status FROM price_reviews WHERE id = 1')
      .first<{ status: string }>();
    expect(review?.status).toBe('approved');
  });

  test('reject → review rejected, không ghi giá', async () => {
    await seedProduct('sjc-bar');
    await env.DB.prepare(
      `INSERT INTO price_reviews (id, product_id, source_id, buy, sell, reason, status, created_at)
       VALUES (2, 'sjc-bar', 'sjc-web', 1, 2, 'invalid_range', 'pending', 1)`,
    ).run();

    expect((await call('POST', '/admin/v1/reviews/2/reject')).status).toBe(200);
    const latest = await env.DB.prepare('SELECT COUNT(*) AS n FROM latest_prices WHERE product_id = ?')
      .bind('sjc-bar')
      .first<{ n: number }>();
    expect(latest?.n).toBe(0);
  });

  test('approve review không tồn tại → 404', async () => {
    expect((await call('POST', '/admin/v1/reviews/999/approve')).status).toBe(404);
  });

  test('manual-price → ghi latest_prices', async () => {
    await seedProduct('sjc-ring');
    const res = await call('POST', '/admin/v1/reviews/manual-price', {
      productId: 'sjc-ring',
      buy: 125000000,
      sell: 127000000,
    });
    expect(res.status).toBe(200);
    const row = await env.DB.prepare('SELECT source_id, sell FROM latest_prices WHERE product_id = ?')
      .bind('sjc-ring')
      .first<{ source_id: string; sell: number }>();
    expect(row?.source_id).toBe('manual');
    expect(row?.sell).toBe(127000000);
  });

  test('manual-price sell < buy → 400', async () => {
    await seedProduct('sjc-ring');
    const res = await call('POST', '/admin/v1/reviews/manual-price', {
      productId: 'sjc-ring',
      buy: 130000000,
      sell: 120000000,
    });
    expect(res.status).toBe(400);
  });
});
