import type { CrawlJob } from '../types.ts';

interface DueSource {
  id: string;
  active_config_version: number;
}

/// Chọn các nguồn đã bật, có cấu hình active, và đến hạn (next_run_at <= now).
/// Claim ngay bằng UPDATE ... RETURNING (dời next_run_at) để lần cron sau không
/// lên lịch trùng, kể cả khi hai lần cron chạy sát nhau.
export async function scheduleDueSources(
  db: D1Database,
  queue: Queue<CrawlJob>,
  now: number,
): Promise<number> {
  const { results } = await db
    .prepare(
      `UPDATE sources
          SET next_run_at = ?1 + interval_sec
        WHERE enabled = 1
          AND active_config_version IS NOT NULL
          AND next_run_at <= ?1
      RETURNING id, active_config_version`,
    )
    .bind(now)
    .all<DueSource>();

  if (results.length === 0) return 0;

  // sendBatch tối đa 100 message/lần.
  for (let i = 0; i < results.length; i += 100) {
    const slice = results.slice(i, i + 100);
    await queue.sendBatch(
      slice.map((s) => ({
        body: {
          type: 'crawl' as const,
          sourceId: s.id,
          version: s.active_config_version,
          at: now,
        },
      })),
    );
  }
  return results.length;
}
