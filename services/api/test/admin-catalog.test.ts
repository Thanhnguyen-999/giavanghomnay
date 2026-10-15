import { applyD1Migrations, env } from 'cloudflare:test';
import { beforeAll, describe, expect, test } from 'vitest';
import app from '../src/index.ts';

// beforeAll chạy ngoài transaction cô lập nên admins được giữ qua mọi test.
// Dữ liệu tạo trong từng test() sẽ bị rollback → mỗi test tự tạo brand/product nó cần.
beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
  await env.DB.batch([
    env.DB.prepare("INSERT INTO admins (email, role) VALUES ('editor@test', 'editor')"),
    env.DB.prepare("INSERT INTO admins (email, role) VALUES ('viewer@test', 'viewer')"),
  ]);
});

function call(method: string, path: string, email: string, body?: unknown): Promise<Response> {
  return app.fetch(
    new Request(`https://api.test${path}`, {
      method,
      headers: {
        'X-Dev-Email': email,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    }),
    env,
  );
}

const brand = (id = 'sjc') => ({ id, slug: id, name: id.toUpperCase(), sortOrder: 1 });

describe('admin brands + products CRUD', () => {
  test('viewer không tạo được brand (403)', async () => {
    const res = await call('POST', '/admin/v1/brands', 'viewer@test', brand());
    expect(res.status).toBe(403);
  });

  test('editor tạo brand + product rồi đọc lại', async () => {
    expect((await call('POST', '/admin/v1/brands', 'editor@test', brand())).status).toBe(201);

    const createProduct = await call('POST', '/admin/v1/products', 'editor@test', {
      id: 'sjc-bar',
      brandId: 'sjc',
      slug: 'mieng',
      name: 'Vàng miếng SJC',
      kind: 'bar',
      purity: '9999',
      region: 'HCM',
    });
    expect(createProduct.status).toBe(201);

    const list = await call('GET', '/admin/v1/products?brand=sjc', 'viewer@test');
    const body = (await list.json()) as { data: { id: string; max_spread_pct: number }[] };
    expect(body.data[0]?.id).toBe('sjc-bar');
    expect(body.data[0]?.max_spread_pct).toBe(10); // default
  });

  test('product với brandId không tồn tại → 400', async () => {
    const res = await call('POST', '/admin/v1/products', 'editor@test', {
      id: 'x',
      brandId: 'khong-co',
      slug: 's',
      name: 'X',
      kind: 'bar',
    });
    expect(res.status).toBe(400);
  });

  test('id sai định dạng → 400', async () => {
    const res = await call('POST', '/admin/v1/brands', 'editor@test', {
      id: 'SJC Viết Hoa',
      slug: 'x',
      name: 'X',
    });
    expect(res.status).toBe(400);
  });

  test('PATCH đổi tên + DELETE soft + audit (một luồng)', async () => {
    expect((await call('POST', '/admin/v1/brands', 'editor@test', brand('doji'))).status).toBe(201);
    expect(
      (await call('PATCH', '/admin/v1/brands/doji', 'editor@test', { name: 'DOJI mới' })).status,
    ).toBe(200);
    expect((await call('DELETE', '/admin/v1/brands/doji', 'editor@test')).status).toBe(200);

    const row = await env.DB.prepare('SELECT name, active FROM brands WHERE id = ?')
      .bind('doji')
      .first<{ name: string; active: number }>();
    expect(row?.name).toBe('DOJI mới');
    expect(row?.active).toBe(0);

    const audit = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM audit_log WHERE entity = 'brand' AND entity_id = 'doji'",
    ).first<{ n: number }>();
    expect(audit?.n ?? 0).toBeGreaterThanOrEqual(3); // create + update + deactivate
  });

  test('PATCH brand không tồn tại → 404', async () => {
    const res = await call('PATCH', '/admin/v1/brands/khong-co', 'editor@test', { name: 'x' });
    expect(res.status).toBe(404);
  });
});
