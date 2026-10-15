import { parseSourceConfig } from '@giavang/extractor';
import { Hono } from 'hono';
import { requireAdmin } from '../../auth/access.ts';
import { previewSource } from '../../crawl/preview.ts';
import { SourceCreate, SourceUpdate } from '../../lib/admin-schemas.ts';
import { writeAudit } from '../../lib/audit.ts';
import { badRequest, notFound } from '../../lib/errors.ts';
import { nowSec } from '../../lib/time.ts';
import type { AppEnv, CrawlJob } from '../../types.ts';

export const sourceRoutes = new Hono<AppEnv>();

sourceRoutes.get('/', requireAdmin('viewer'), async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT id, name, kind, enabled, interval_sec, active_config_version,
            next_run_at, terms_checked, note, updated_at
       FROM sources ORDER BY kind, id`,
  ).all();
  return c.json({ data: results });
});

sourceRoutes.post('/', requireAdmin('editor'), async (c) => {
  const parsed = SourceCreate.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ');
  const s = parsed.data;

  try {
    await c.env.DB.prepare(
      `INSERT INTO sources (id, name, kind, interval_sec, note, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    )
      .bind(s.id, s.name, s.kind, s.intervalSec, s.note ?? null, nowSec())
      .run();
  } catch (e) {
    throw badRequest(`Không tạo được nguồn (trùng id?): ${String(e)}`, 'conflict');
  }

  await writeAudit(c.env.DB, {
    actor: c.get('adminEmail'),
    action: 'source.create',
    entity: 'source',
    entityId: s.id,
    after: s,
  });
  return c.json({ data: { id: s.id } }, 201);
});

sourceRoutes.patch('/:id', requireAdmin('editor'), async (c) => {
  const id = c.req.param('id');
  const parsed = SourceUpdate.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ');

  const before = await c.env.DB.prepare('SELECT * FROM sources WHERE id = ?').bind(id).first();
  if (!before) throw notFound('Không tìm thấy nguồn');

  const u = parsed.data;

  // An toàn: chỉ cho bật nguồn khi đã kiểm tra điều khoản và có cấu hình active.
  if (u.enabled === true) {
    const termsOk = u.termsChecked === true || (before as { terms_checked: number }).terms_checked === 1;
    const hasConfig = (before as { active_config_version: number | null }).active_config_version != null;
    if (!termsOk) throw badRequest('Phải xác nhận đã kiểm tra điều khoản (termsChecked) trước khi bật');
    if (!hasConfig) throw badRequest('Nguồn chưa có cấu hình active để bật');
  }

  const sets: string[] = [];
  const vals: unknown[] = [];
  if (u.name !== undefined) (sets.push('name = ?'), vals.push(u.name));
  if (u.intervalSec !== undefined) (sets.push('interval_sec = ?'), vals.push(u.intervalSec));
  if (u.enabled !== undefined) (sets.push('enabled = ?'), vals.push(u.enabled ? 1 : 0));
  if (u.termsChecked !== undefined) (sets.push('terms_checked = ?'), vals.push(u.termsChecked ? 1 : 0));
  if (u.note !== undefined) (sets.push('note = ?'), vals.push(u.note));
  if (sets.length === 0) throw badRequest('Không có trường nào để cập nhật');

  sets.push('updated_at = ?');
  vals.push(nowSec());
  vals.push(id);
  await c.env.DB.prepare(`UPDATE sources SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...vals)
    .run();

  await writeAudit(c.env.DB, {
    actor: c.get('adminEmail'),
    action: 'source.update',
    entity: 'source',
    entityId: id,
    before,
    after: u,
  });
  return c.json({ data: { id } });
});

// ───────── Cấu hình (bất biến, versioned) ─────────

sourceRoutes.get('/:id/configs', requireAdmin('viewer'), async (c) => {
  const id = c.req.param('id');
  const { results } = await c.env.DB.prepare(
    `SELECT version, config, note, created_by, created_at
       FROM source_configs WHERE source_id = ? ORDER BY version DESC`,
  )
    .bind(id)
    .all();
  return c.json({ data: results });
});

// Tạo version mới. Validate config bằng zod TRƯỚC khi lưu.
sourceRoutes.post('/:id/configs', requireAdmin('editor'), async (c) => {
  const id = c.req.param('id');
  const body = (await c.req.json().catch(() => null)) as { config?: unknown; note?: string } | null;
  if (!body?.config) throw badRequest('Thiếu trường config');

  try {
    parseSourceConfig(body.config);
  } catch (e) {
    throw badRequest(`Cấu hình không hợp lệ: ${String(e)}`);
  }

  const source = await c.env.DB.prepare('SELECT id FROM sources WHERE id = ?').bind(id).first();
  if (!source) throw notFound('Không tìm thấy nguồn');

  const max = await c.env.DB.prepare(
    'SELECT COALESCE(MAX(version), 0) AS v FROM source_configs WHERE source_id = ?',
  )
    .bind(id)
    .first<{ v: number }>();
  const version = (max?.v ?? 0) + 1;

  await c.env.DB.prepare(
    `INSERT INTO source_configs (source_id, version, config, note, created_by)
     VALUES (?1, ?2, ?3, ?4, ?5)`,
  )
    .bind(id, version, JSON.stringify(body.config), body.note ?? null, c.get('adminEmail'))
    .run();

  await writeAudit(c.env.DB, {
    actor: c.get('adminEmail'),
    action: 'source.config.create',
    entity: 'source_config',
    entityId: `${id}:${version}`,
    after: { version },
  });
  return c.json({ data: { sourceId: id, version } }, 201);
});

// Kích hoạt một version (rollback = activate version cũ).
sourceRoutes.post('/:id/activate', requireAdmin('editor'), async (c) => {
  const id = c.req.param('id');
  const body = (await c.req.json().catch(() => null)) as { version?: number } | null;
  const version = body?.version;
  if (typeof version !== 'number') throw badRequest('Thiếu version');

  const cfg = await c.env.DB.prepare(
    'SELECT version FROM source_configs WHERE source_id = ? AND version = ?',
  )
    .bind(id, version)
    .first();
  if (!cfg) throw notFound('Không tìm thấy version cấu hình');

  await c.env.DB.prepare('UPDATE sources SET active_config_version = ?, updated_at = ? WHERE id = ?')
    .bind(version, nowSec(), id)
    .run();

  await writeAudit(c.env.DB, {
    actor: c.get('adminEmail'),
    action: 'source.config.activate',
    entity: 'source',
    entityId: id,
    after: { activeConfigVersion: version },
  });
  return c.json({ data: { id, activeConfigVersion: version } });
});

// Chạy thử: fetch + extract, KHÔNG ghi. Nhận config trong body, hoặc dùng version đã lưu.
sourceRoutes.post('/:id/preview', requireAdmin('editor'), async (c) => {
  const id = c.req.param('id');
  const body = (await c.req.json().catch(() => null)) as
    | { config?: unknown; version?: number }
    | null;

  let rawConfig = body?.config;
  if (!rawConfig) {
    const version = body?.version;
    const row = await c.env.DB.prepare(
      version != null
        ? 'SELECT config FROM source_configs WHERE source_id = ?1 AND version = ?2'
        : `SELECT sc.config FROM source_configs sc
             JOIN sources s ON s.id = sc.source_id AND s.active_config_version = sc.version
            WHERE s.id = ?1`,
    )
      .bind(...(version != null ? [id, version] : [id]))
      .first<{ config: string }>();
    if (!row) throw notFound('Không có cấu hình để chạy thử');
    rawConfig = JSON.parse(row.config);
  }

  try {
    const result = await previewSource(rawConfig);
    return c.json({ data: result });
  } catch (e) {
    throw badRequest(`Chạy thử thất bại: ${String(e)}`, 'preview_failed');
  }
});

// Chạy ngay: đẩy một job crawl vào queue với version active (không chờ cron).
sourceRoutes.post('/:id/run', requireAdmin('editor'), async (c) => {
  const id = c.req.param('id');
  const source = await c.env.DB.prepare(
    'SELECT active_config_version FROM sources WHERE id = ?',
  )
    .bind(id)
    .first<{ active_config_version: number | null }>();
  if (!source) throw notFound('Không tìm thấy nguồn');
  if (source.active_config_version == null) throw badRequest('Nguồn chưa có cấu hình active');

  const job: CrawlJob = {
    type: 'crawl',
    sourceId: id,
    version: source.active_config_version,
    at: nowSec(),
  };
  await c.env.CRAWL_QUEUE.send(job);

  await writeAudit(c.env.DB, {
    actor: c.get('adminEmail'),
    action: 'source.run',
    entity: 'source',
    entityId: id,
  });
  return c.json({ data: { id, queued: true } });
});
