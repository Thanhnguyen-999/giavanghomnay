import { Hono } from 'hono';
import { requireAdmin } from '../../auth/access.ts';
import { ProductCreate, ProductUpdate } from '../../lib/admin-schemas.ts';
import { writeAudit } from '../../lib/audit.ts';
import { refreshLatestSnapshot } from '../../lib/cache.ts';
import { badRequest, notFound } from '../../lib/errors.ts';
import { nowSec } from '../../lib/time.ts';
import type { AppEnv } from '../../types.ts';

export const productRoutes = new Hono<AppEnv>();

productRoutes.get('/', requireAdmin('viewer'), async (c) => {
  const brand = c.req.query('brand');
  const sql = `SELECT id, brand_id, slug, name, kind, purity, region,
                      max_spread_pct, max_change_pct, sort_order, active, updated_at
                 FROM products ${brand ? 'WHERE brand_id = ?1' : ''}
                ORDER BY brand_id, sort_order, name`;
  const stmt = brand ? c.env.DB.prepare(sql).bind(brand) : c.env.DB.prepare(sql);
  const { results } = await stmt.all();
  return c.json({ data: results });
});

productRoutes.post('/', requireAdmin('editor'), async (c) => {
  const parsed = ProductCreate.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ');
  const p = parsed.data;

  const brand = await c.env.DB.prepare('SELECT id FROM brands WHERE id = ?').bind(p.brandId).first();
  if (!brand) throw badRequest('brandId không tồn tại');

  try {
    await c.env.DB.prepare(
      `INSERT INTO products
         (id, brand_id, slug, name, kind, purity, region, max_spread_pct, max_change_pct, sort_order, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
    )
      .bind(
        p.id,
        p.brandId,
        p.slug,
        p.name,
        p.kind,
        p.purity ?? null,
        p.region ?? null,
        p.maxSpreadPct,
        p.maxChangePct,
        p.sortOrder,
        nowSec(),
      )
      .run();
  } catch (e) {
    throw badRequest(`Không tạo được sản phẩm (trùng id hoặc brand+slug?): ${String(e)}`, 'conflict');
  }

  await writeAudit(c.env.DB, {
    actor: c.get('adminEmail'),
    action: 'product.create',
    entity: 'product',
    entityId: p.id,
    after: p,
  });
  await refreshLatestSnapshot(c.env);
  return c.json({ data: { id: p.id } }, 201);
});

productRoutes.patch('/:id', requireAdmin('editor'), async (c) => {
  const id = c.req.param('id');
  const parsed = ProductUpdate.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ');

  const before = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();
  if (!before) throw notFound('Không tìm thấy sản phẩm');

  const u = parsed.data;
  const map: Record<string, [string, unknown]> = {};
  if (u.slug !== undefined) map.slug = ['slug', u.slug];
  if (u.name !== undefined) map.name = ['name', u.name];
  if (u.kind !== undefined) map.kind = ['kind', u.kind];
  if (u.purity !== undefined) map.purity = ['purity', u.purity];
  if (u.region !== undefined) map.region = ['region', u.region];
  if (u.maxSpreadPct !== undefined) map.maxSpreadPct = ['max_spread_pct', u.maxSpreadPct];
  if (u.maxChangePct !== undefined) map.maxChangePct = ['max_change_pct', u.maxChangePct];
  if (u.sortOrder !== undefined) map.sortOrder = ['sort_order', u.sortOrder];
  if (u.active !== undefined) map.active = ['active', u.active ? 1 : 0];

  const entries = Object.values(map);
  if (entries.length === 0) throw badRequest('Không có trường nào để cập nhật');

  const sets = entries.map(([col]) => `${col} = ?`);
  const vals = entries.map(([, v]) => v);
  sets.push('updated_at = ?');
  vals.push(nowSec());
  vals.push(id);

  await c.env.DB.prepare(`UPDATE products SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...vals)
    .run();

  await writeAudit(c.env.DB, {
    actor: c.get('adminEmail'),
    action: 'product.update',
    entity: 'product',
    entityId: id,
    before,
    after: u,
  });
  await refreshLatestSnapshot(c.env);
  return c.json({ data: { id } });
});

productRoutes.delete('/:id', requireAdmin('editor'), async (c) => {
  const id = c.req.param('id');
  const r = await c.env.DB.prepare(
    'UPDATE products SET active = 0, updated_at = ? WHERE id = ?',
  )
    .bind(nowSec(), id)
    .run();
  if (r.meta.changes === 0) throw notFound('Không tìm thấy sản phẩm');

  await writeAudit(c.env.DB, {
    actor: c.get('adminEmail'),
    action: 'product.deactivate',
    entity: 'product',
    entityId: id,
  });
  await refreshLatestSnapshot(c.env);
  return c.json({ data: { id, active: false } });
});
