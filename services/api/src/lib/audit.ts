import { nowSec } from './time.ts';

/// Ghi một dòng audit cho thao tác ghi của admin.
/// before/after là object tùy ý (sẽ JSON.stringify); null nếu không áp dụng.
export async function writeAudit(
  db: D1Database,
  entry: {
    actor: string;
    action: string;
    entity: string;
    entityId: string;
    before?: unknown;
    after?: unknown;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO audit_log (actor, action, entity, entity_id, before_json, after_json, at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
    )
    .bind(
      entry.actor,
      entry.action,
      entry.entity,
      entry.entityId,
      entry.before === undefined ? null : JSON.stringify(entry.before),
      entry.after === undefined ? null : JSON.stringify(entry.after),
      nowSec(),
    )
    .run();
}
