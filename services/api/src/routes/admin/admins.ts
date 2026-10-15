import { Hono } from 'hono';
import { requireAdmin } from '../../auth/access.ts';
import { AdminUpsert } from '../../lib/admin-schemas.ts';
import { writeAudit } from '../../lib/audit.ts';
import { badRequest, notFound } from '../../lib/errors.ts';
import type { AppEnv } from '../../types.ts';

export const adminUserRoutes = new Hono<AppEnv>();

adminUserRoutes.get('/', requireAdmin('owner'), async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT email, role, active, created_at FROM admins ORDER BY email',
  ).all();
  return c.json({ data: results });
});

// Thêm hoặc đổi role admin.
adminUserRoutes.post('/', requireAdmin('owner'), async (c) => {
  const parsed = AdminUpsert.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ');
  const email = parsed.data.email.toLowerCase();
  const { role } = parsed.data;

  await c.env.DB.prepare(
    `INSERT INTO admins (email, role, active) VALUES (?1, ?2, 1)
     ON CONFLICT (email) DO UPDATE SET role = excluded.role, active = 1`,
  )
    .bind(email, role)
    .run();

  await writeAudit(c.env.DB, {
    actor: c.get('adminEmail'),
    action: 'admin.upsert',
    entity: 'admin',
    entityId: email,
    after: { role },
  });
  return c.json({ data: { email, role } }, 201);
});

// Vô hiệu hóa admin (soft). Không cho tự xóa chính mình để tránh khóa cả hệ thống.
adminUserRoutes.delete('/:email', requireAdmin('owner'), async (c) => {
  const email = decodeURIComponent(c.req.param('email')).toLowerCase();
  if (email === c.get('adminEmail')) throw badRequest('Không thể tự vô hiệu hóa chính mình');

  // Phải còn ít nhất một owner active sau khi xóa.
  if (await isLastActiveOwner(c.env.DB, email)) {
    throw badRequest('Phải còn ít nhất một owner đang hoạt động');
  }

  const r = await c.env.DB.prepare('UPDATE admins SET active = 0 WHERE email = ?')
    .bind(email)
    .run();
  if (r.meta.changes === 0) throw notFound('Không tìm thấy admin');

  await writeAudit(c.env.DB, {
    actor: c.get('adminEmail'),
    action: 'admin.deactivate',
    entity: 'admin',
    entityId: email,
  });
  return c.json({ data: { email, active: false } });
});

async function isLastActiveOwner(db: D1Database, email: string): Promise<boolean> {
  const target = await db
    .prepare('SELECT role, active FROM admins WHERE email = ?')
    .bind(email)
    .first<{ role: string; active: number }>();
  if (!target || target.role !== 'owner' || target.active !== 1) return false;

  const count = await db
    .prepare("SELECT COUNT(*) AS n FROM admins WHERE role = 'owner' AND active = 1")
    .first<{ n: number }>();
  return (count?.n ?? 0) <= 1;
}
