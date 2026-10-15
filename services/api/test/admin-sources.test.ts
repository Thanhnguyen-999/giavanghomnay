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

const validConfig = {
  request: { url: 'https://example.com/api' },
  format: 'json',
  rows: '.',
  fields: { label: { path: 'symbol' }, price: { path: 'price' } },
  number: { thousandSeparator: ',', decimalSeparator: '.', multiplier: 1 },
  keyTemplate: '{label}',
};

describe('admin sources + configs', () => {
  test('tạo nguồn, thêm 2 version config, activate, rollback', async () => {
    expect(
      (await call('POST', '/admin/v1/sources', {
        id: 'world-xau',
        name: 'XAU',
        kind: 'world',
      })).status,
    ).toBe(201);

    const v1 = await call('POST', '/admin/v1/sources/world-xau/configs', { config: validConfig });
    expect(v1.status).toBe(201);
    expect(((await v1.json()) as { data: { version: number } }).data.version).toBe(1);

    const v2 = await call('POST', '/admin/v1/sources/world-xau/configs', {
      config: { ...validConfig, keyTemplate: '{label}-v2' },
    });
    expect(((await v2.json()) as { data: { version: number } }).data.version).toBe(2);

    // Activate v2 rồi rollback về v1.
    expect((await call('POST', '/admin/v1/sources/world-xau/activate', { version: 2 })).status).toBe(200);
    let row = await env.DB.prepare('SELECT active_config_version AS v FROM sources WHERE id = ?')
      .bind('world-xau')
      .first<{ v: number }>();
    expect(row?.v).toBe(2);

    expect((await call('POST', '/admin/v1/sources/world-xau/activate', { version: 1 })).status).toBe(200);
    row = await env.DB.prepare('SELECT active_config_version AS v FROM sources WHERE id = ?')
      .bind('world-xau')
      .first<{ v: number }>();
    expect(row?.v).toBe(1);
  });

  test('config sai schema → 400, không lưu version', async () => {
    await call('POST', '/admin/v1/sources', { id: 'bad-src', name: 'bad', kind: 'world' });
    const res = await call('POST', '/admin/v1/sources/bad-src/configs', {
      config: { request: { url: 'http://insecure.com' }, format: 'json', rows: '.', fields: {} },
    });
    expect(res.status).toBe(400);

    const n = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM source_configs WHERE source_id = 'bad-src'",
    ).first<{ n: number }>();
    expect(n?.n).toBe(0);
  });

  test('activate version không tồn tại → 404', async () => {
    await call('POST', '/admin/v1/sources', { id: 's2', name: 's2', kind: 'world' });
    const res = await call('POST', '/admin/v1/sources/s2/activate', { version: 99 });
    expect(res.status).toBe(404);
  });

  test('bật nguồn khi chưa có config active → 400', async () => {
    await call('POST', '/admin/v1/sources', { id: 's3', name: 's3', kind: 'world' });
    const res = await call('PATCH', '/admin/v1/sources/s3', { enabled: true, termsChecked: true });
    expect(res.status).toBe(400);
  });

  test('run khi chưa có config active → 400', async () => {
    await call('POST', '/admin/v1/sources', { id: 's4', name: 's4', kind: 'world' });
    const res = await call('POST', '/admin/v1/sources/s4/run');
    expect(res.status).toBe(400);
  });

  test('preview với config URL không-https → báo lỗi (không fetch ra ngoài)', async () => {
    const res = await call('POST', '/admin/v1/sources/any/preview', {
      config: { ...validConfig, request: { url: 'http://insecure.local' } },
    });
    // URL http → zod reject ngay ở parseSourceConfig → 400.
    expect(res.status).toBe(400);
  });
});
