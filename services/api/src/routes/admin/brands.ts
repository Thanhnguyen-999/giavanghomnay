import { Hono } from 'hono';
import { requireAdmin } from '../../auth/access.ts';
import { BrandCreate, BrandUpdate } from '../../lib/admin-schemas.ts';
import { refreshLatestSnapshot } from '../../lib/cache.ts';
import { writeAudit } from '../../lib/audit.ts';
import { badRequest, notFound } from '../../lib/errors.ts';
import { nowSec } from '../../lib/time.ts';
import type { AppEnv } from '../../types.ts';

export const brandRoutes = new Hono<AppEnv>();

brandRoutes.get('/', requireAdmin('viewer'), async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, slug, name, logo_r2_key, sort_order, active, updated_at FROM brands ORDER BY sort_order, name',
  ).all();
  return c.json({ data: results });
});

brandRoutes.post('/', requireAdmin('editor'), async (c) => {
  const parsed = BrandCreate.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ');
  const b = parsed.data;

  try {
    await c.env.DB.prepare(
      `INSERT INTO brands (id, slug, name, logo_r2_key, sort_order, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    )
      .bind(b.id, b.slug, b.name, b.logoR2Key ?? null, b.sortOrder, nowSec())
      .run();
  } catch (e) {
    throw badRequest(`Không tạo được thương hiệu (trùng id/slug?): ${String(e)}`, 'conflict');
  }

  await writeAudit(c.env.DB, {
    actor: c.get('adminEmail'),
    action: 'brand.create',
    entity: 'brand',
    entityId: b.id,
    after: b,
  });
  await refreshLatestSnapshot(c.env);
  return c.json({ data: { id: b.id } }, 201);
});

brandRoutes.patch('/:id', requireAdmin('editor'), async (c) => {
  const id = c.req.param('id');
  const parsed = BrandUpdate.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ');

  const before = await c.env.DB.prepare('SELECT * FROM brands WHERE id = ?').bind(id).first();
  if (!before) throw notFound('Không tìm thấy thương hiệu');

  const u = parsed.data;
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (u.slug !== undefined) (sets.push('slug = ?'), vals.push(u.slug));
  if (u.name !== undefined) (sets.push('name = ?'), vals.push(u.name));
  if (u.logoR2Key !== undefined) (sets.push('logo_r2_key = ?'), vals.push(u.logoR2Key));
  if (u.sortOrder !== undefined) (sets.push('sort_order = ?'), vals.push(u.sortOrder));
  if (u.active !== undefined) (sets.push('active = ?'), vals.push(u.active ? 1 : 0));
  if (sets.length === 0) throw badRequest('Không có trường nào để cập nhật');

  sets.push('updated_at = ?');
  vals.push(nowSec());
  vals.push(id);

  await c.env.DB.prepare(`UPDATE brands SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...vals)
    .run();

  await writeAudit(c.env.DB, {
    actor: c.get('adminEmail'),
    action: 'brand.update',
    entity: 'brand',
    entityId: id,
    before,
    after: u,
  });
  await refreshLatestSnapshot(c.env);
  return c.json({ data: { id } });
});

// Soft delete: ẩn (active=0), giữ lịch sử giá.
brandRoutes.delete('/:id', requireAdmin('editor'), async (c) => {
  const id = c.req.param('id');
  const r = await c.env.DB.prepare(
    'UPDATE brands SET active = 0, updated_at = ? WHERE id = ?',
  )
    .bind(nowSec(), id)
    .run();
  if (r.meta.changes === 0) throw notFound('Không tìm thấy thương hiệu');

  await writeAudit(c.env.DB, {
    actor: c.get('adminEmail'),
    action: 'brand.deactivate',
    entity: 'brand',
    entityId: id,
  });
  await refreshLatestSnapshot(c.env);
  return c.json({ data: { id, active: false } });
});
