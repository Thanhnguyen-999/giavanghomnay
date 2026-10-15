import { applyD1Migrations, env } from 'cloudflare:test';
import { beforeAll, describe, expect, test } from 'vitest';
import app from '../src/index.ts';

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
  await env.DB.batch([
    env.DB.prepare("INSERT INTO admins (email, role) VALUES ('owner@test', 'owner')"),
    env.DB.prepare("INSERT INTO admins (email, role) VALUES ('editor@test', 'editor')"),
    env.DB.prepare("INSERT INTO admins (email, role) VALUES ('viewer@test', 'viewer')"),
    env.DB.prepare("INSERT INTO admins (email, role, active) VALUES ('off@test', 'owner', 0)"),
  ]);
});

// Dev-mode: email lấy từ header X-Dev-Email (chỉ khi ENVIRONMENT=dev).
function asAdmin(path: string, email?: string): Request {
  const headers: Record<string, string> = {};
  if (email) headers['X-Dev-Email'] = email;
  return new Request(`https://api.test${path}`, { headers });
}

describe('requireAdmin', () => {
  test('không có email (dev không set, Access chưa cấu hình) → không cho vào', async () => {
    // Rơi xuống nhánh Access; test không cấu hình Access → 500 (config_error).
    // Điểm cốt lõi: KHÔNG trả 2xx khi không xác định được danh tính.
    const res = await app.fetch(asAdmin('/admin/v1/me'), env);
    expect(res.ok).toBe(false);
    expect(res.status).toBeGreaterThanOrEqual(401);
  });

  test('email không nằm trong bảng admins → 403', async () => {
    const res = await app.fetch(asAdmin('/admin/v1/me', 'nguoila@test'), env);
    expect(res.status).toBe(403);
  });

  test('admin bị vô hiệu hóa (active=0) → 403', async () => {
    const res = await app.fetch(asAdmin('/admin/v1/me', 'off@test'), env);
    expect(res.status).toBe(403);
  });

  test('viewer gọi /me → 200, trả đúng role', async () => {
    const res = await app.fetch(asAdmin('/admin/v1/me', 'viewer@test'), env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { email: string; role: string } };
    expect(body.data).toEqual({ email: 'viewer@test', role: 'viewer' });
  });

  test('owner gọi /me → 200', async () => {
    const res = await app.fetch(asAdmin('/admin/v1/me', 'owner@test'), env);
    expect(res.status).toBe(200);
  });

  test('email khớp không phân biệt hoa thường', async () => {
    const res = await app.fetch(asAdmin('/admin/v1/me', 'Owner@Test'), env);
    expect(res.status).toBe(200);
  });
});
