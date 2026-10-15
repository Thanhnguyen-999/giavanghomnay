import { Hono } from 'hono';
import { requireAdmin } from '../../auth/access.ts';
import { MappingUpdate } from '../../lib/admin-schemas.ts';
import { writeAudit } from '../../lib/audit.ts';
import { badRequest, notFound } from '../../lib/errors.ts';
import type { AppEnv } from '../../types.ts';

export const mappingRoutes = new Hono<AppEnv>();

// Danh sách nhãn thô của một nguồn, lọc theo status (mặc định pending).
mappingRoutes.get('/:sourceId', requireAdmin('viewer'), async (c) => {
  const sourceId = c.req.param('sourceId');
  const status = c.req.query('status') ?? 'pending';
  const { results } = await c.env.DB.prepare(
    `SELECT source_id, raw_key, product_id, status, sample_buy, sample_sell, last_seen_at
       FROM source_mappings
      WHERE source_id = ?1 AND status = ?2
      ORDER BY last_seen_at DESC`,
  )
    .bind(sourceId, status)
    .all();
  return c.json({ data: results });
});

// Gán nhãn → product (status='mapped') hoặc bỏ qua ('ignored') / trả về 'pending'.
mappingRoutes.patch('/:sourceId/:rawKey', requireAdmin('editor'), async (c) => {
  const sourceId = c.req.param('sourceId');
  const rawKey = decodeURIComponent(c.req.param('rawKey'));
  const parsed = MappingUpdate.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ');
  const { productId, status } = parsed.data;

  if (status === 'mapped' && !productId) throw badRequest('status=mapped cần productId');

  if (productId) {
    const p = await c.env.DB.prepare('SELECT id FROM products WHERE id = ? AND active = 1')
      .bind(productId)
      .first();
    if (!p) throw badRequest('productId không tồn tại hoặc đã ẩn');
  }

  const existing = await c.env.DB.prepare(
    'SELECT raw_key FROM source_mappings WHERE source_id = ? AND raw_key = ?',
  )
    .bind(sourceId, rawKey)
    .first();
  if (!existing) throw notFound('Không tìm thấy nhãn');

  try {
    await c.env.DB.prepare(
      'UPDATE source_mappings SET product_id = ?1, status = ?2 WHERE source_id = ?3 AND raw_key = ?4',
    )
      .bind(status === 'mapped' ? productId : null, status, sourceId, rawKey)
      .run();
  } catch (e) {
    // uq_mapping_product: một product chỉ có một nguồn 'mapped'.
    throw badRequest(`Không gán được (product đã map ở nguồn khác?): ${String(e)}`, 'conflict');
  }

  await writeAudit(c.env.DB, {
    actor: c.get('adminEmail'),
    action: 'mapping.update',
    entity: 'mapping',
    entityId: `${sourceId}:${rawKey}`,
    after: { productId, status },
  });
  return c.json({ data: { sourceId, rawKey, status, productId: productId ?? null } });
});
