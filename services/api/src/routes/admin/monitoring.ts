import { Hono } from 'hono';
import { requireAdmin } from '../../auth/access.ts';
import type { AppEnv } from '../../types.ts';

export const monitoringRoutes = new Hono<AppEnv>();

// Nhật ký crawl (viewer): theo dõi sức khỏe nguồn.
monitoringRoutes.get('/crawl-runs', requireAdmin('viewer'), async (c) => {
  const sourceId = c.req.query('sourceId');
  const limit = Math.min(Number(c.req.query('limit') ?? 50), 200);
  const sql = `SELECT id, source_id, config_version, started_at, duration_ms, status,
                      rows_parsed, rows_changed, error
                 FROM crawl_runs ${sourceId ? 'WHERE source_id = ?1' : ''}
                ORDER BY started_at DESC
                LIMIT ${sourceId ? '?2' : '?1'}`;
  const stmt = sourceId
    ? c.env.DB.prepare(sql).bind(sourceId, limit)
    : c.env.DB.prepare(sql).bind(limit);
  const { results } = await stmt.all();
  return c.json({ data: results });
});

// Audit log (owner): ai sửa gì.
monitoringRoutes.get('/audit', requireAdmin('owner'), async (c) => {
  const entity = c.req.query('entity');
  const limit = Math.min(Number(c.req.query('limit') ?? 100), 500);
  const sql = `SELECT id, actor, action, entity, entity_id, before_json, after_json, at
                 FROM audit_log ${entity ? 'WHERE entity = ?1' : ''}
                ORDER BY at DESC, id DESC
                LIMIT ${entity ? '?2' : '?1'}`;
  const stmt = entity
    ? c.env.DB.prepare(sql).bind(entity, limit)
    : c.env.DB.prepare(sql).bind(limit);
  const { results } = await stmt.all();
  return c.json({ data: results });
});
