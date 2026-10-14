import { Hono } from 'hono';
import type { AppEnv } from '../types.ts';

export const health = new Hono<AppEnv>();

// Kiểm tra Worker chạy và D1 kết nối được.
health.get('/health', async (c) => {
  c.header('Cache-Control', 'no-store');
  const row = await c.env.DB.prepare(
    "SELECT COUNT(*) AS tables FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite%' AND name NOT LIKE '_cf%'",
  ).first<{ tables: number }>();
  return c.json({ data: { status: 'ok', d1_tables: row?.tables ?? 0 } });
});
