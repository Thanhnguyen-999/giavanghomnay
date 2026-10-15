import { Hono } from 'hono';
import { requireAdmin } from '../../auth/access.ts';
import { publishDomestic } from '../../crawl/publish.ts';
import { ManualPrice } from '../../lib/admin-schemas.ts';
import { writeAudit } from '../../lib/audit.ts';
import { refreshLatestSnapshot } from '../../lib/cache.ts';
import { badRequest, notFound } from '../../lib/errors.ts';
import { nowSec } from '../../lib/time.ts';
import type { AppEnv } from '../../types.ts';

export const reviewRoutes = new Hono<AppEnv>();

interface ReviewRow {
  id: number;
  product_id: string;
  source_id: string;
  buy: number;
  sell: number;
  reason: string;
  status: string;
}

reviewRoutes.get('/', requireAdmin('viewer'), async (c) => {
  const status = c.req.query('status') ?? 'pending';
  const { results } = await c.env.DB.prepare(
    `SELECT r.id, r.product_id, p.name AS product_name, r.source_id, r.buy, r.sell,
            r.prev_buy, r.prev_sell, r.reason, r.status, r.created_at
       FROM price_reviews r
       JOIN products p ON p.id = r.product_id
      WHERE r.status = ?1
      ORDER BY r.created_at DESC`,
  )
    .bind(status)
    .all();
  return c.json({ data: results });
});

// Duyệt: publish giá qua cùng pipeline (tick + latest + daily), đánh dấu approved.
reviewRoutes.post('/:id/approve', requireAdmin('editor'), async (c) => {
  const id = Number(c.req.param('id'));
  const review = await c.env.DB.prepare(
    "SELECT * FROM price_reviews WHERE id = ? AND status = 'pending'",
  )
    .bind(id)
    .first<ReviewRow>();
  if (!review) throw notFound('Không tìm thấy review đang chờ');

  const now = nowSec();
  await publishDomestic(
    c.env.DB,
    review.source_id,
    [{ productId: review.product_id, buy: review.buy, sell: review.sell }],
    now,
  );
  await c.env.DB.prepare(
    "UPDATE price_reviews SET status = 'approved', reviewed_by = ?2, reviewed_at = ?3 WHERE id = ?1",
  )
    .bind(id, c.get('adminEmail'), now)
    .run();
  await refreshLatestSnapshot(c.env);

  await writeAudit(c.env.DB, {
    actor: c.get('adminEmail'),
    action: 'review.approve',
    entity: 'price_review',
    entityId: String(id),
    after: { productId: review.product_id, buy: review.buy, sell: review.sell },
  });
  return c.json({ data: { id, status: 'approved' } });
});

reviewRoutes.post('/:id/reject', requireAdmin('editor'), async (c) => {
  const id = Number(c.req.param('id'));
  const r = await c.env.DB.prepare(
    "UPDATE price_reviews SET status = 'rejected', reviewed_by = ?2, reviewed_at = ?3 WHERE id = ?1 AND status = 'pending'",
  )
    .bind(id, c.get('adminEmail'), nowSec())
    .run();
  if (r.meta.changes === 0) throw notFound('Không tìm thấy review đang chờ');

  await writeAudit(c.env.DB, {
    actor: c.get('adminEmail'),
    action: 'review.reject',
    entity: 'price_review',
    entityId: String(id),
  });
  return c.json({ data: { id, status: 'rejected' } });
});

// Nhập giá tay: publish trực tiếp với source_id='manual' (bỏ qua validate ngưỡng).
reviewRoutes.post('/manual-price', requireAdmin('editor'), async (c) => {
  const parsed = ManualPrice.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ');
  const { productId, buy, sell } = parsed.data;
  if (sell < buy) throw badRequest('sell phải >= buy');

  const product = await c.env.DB.prepare('SELECT id FROM products WHERE id = ? AND active = 1')
    .bind(productId)
    .first();
  if (!product) throw badRequest('productId không tồn tại hoặc đã ẩn');

  const now = nowSec();
  await publishDomestic(c.env.DB, 'manual', [{ productId, buy, sell }], now);
  await refreshLatestSnapshot(c.env);

  await writeAudit(c.env.DB, {
    actor: c.get('adminEmail'),
    action: 'price.manual',
    entity: 'product',
    entityId: productId,
    after: { buy, sell },
  });
  return c.json({ data: { productId, buy, sell } });
});
