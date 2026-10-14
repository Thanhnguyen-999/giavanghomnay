import { type ExtractedRow, extract, parseSourceConfig } from '@giavang/extractor';
import { refreshLatestSnapshot } from '../lib/cache.ts';
import { nowSec } from '../lib/time.ts';
import type { Bindings, CrawlJob } from '../types.ts';
import { safeFetch } from './fetcher.ts';
import {
  type PublishRow,
  type WorldRow,
  publishDomestic,
  publishWorld,
  touchChecked,
} from './publish.ts';
import { type Decision, decide } from './validate.ts';

interface SourceRow {
  id: string;
  kind: 'domestic' | 'world' | 'fx';
  active_config_version: number | null;
}

interface MappingRow {
  raw_key: string;
  product_id: string | null;
  status: 'pending' | 'mapped' | 'ignored';
}

interface ProductRow {
  id: string;
  max_spread_pct: number;
  max_change_pct: number;
}

interface LatestRow {
  product_id: string;
  buy: number;
  sell: number;
}

interface RunOutcome {
  status: 'ok' | 'partial' | 'failed' | 'quarantined';
  rowsParsed: number;
  rowsChanged: number;
  error?: string;
}

/// Xử lý một job crawl (một nguồn). Không ném: luôn ghi crawl_runs và trả outcome,
/// để lỗi một nguồn không làm hỏng cả batch.
export async function runCrawlJob(env: Bindings, job: CrawlJob): Promise<RunOutcome> {
  const startedAt = Date.now();
  const now = nowSec();
  let outcome: RunOutcome = { status: 'failed', rowsParsed: 0, rowsChanged: 0 };

  try {
    const source = await env.DB.prepare(
      'SELECT id, kind, active_config_version FROM sources WHERE id = ? AND enabled = 1',
    )
      .bind(job.sourceId)
      .first<SourceRow>();

    if (!source) return done({ status: 'failed', rowsParsed: 0, rowsChanged: 0, error: 'source not found/disabled' });

    // Cấu hình đã đổi sau khi job được lên lịch → bỏ qua (job cũ).
    if (source.active_config_version !== job.version) {
      return done({ status: 'ok', rowsParsed: 0, rowsChanged: 0, error: 'stale version, skipped' });
    }

    const configRow = await env.DB.prepare(
      'SELECT config FROM source_configs WHERE source_id = ? AND version = ?',
    )
      .bind(source.id, job.version)
      .first<{ config: string }>();
    if (!configRow) return done({ status: 'failed', rowsParsed: 0, rowsChanged: 0, error: 'config missing' });

    const config = parseSourceConfig(JSON.parse(configRow.config));
    const fetched = await safeFetch(config.request);
    if (fetched.status < 200 || fetched.status >= 300) {
      return done({ status: 'failed', rowsParsed: 0, rowsChanged: 0, error: `HTTP ${fetched.status}` });
    }

    const { rows, warnings } = await extract(config, fetched.body);

    outcome =
      source.kind === 'domestic'
        ? await runDomestic(env, source.id, rows, now)
        : await runWorld(env, source.kind, rows, now);

    if (warnings.length > 0 && outcome.status === 'ok') outcome.status = 'partial';
    return done(outcome);
  } catch (e) {
    return done({ status: 'failed', rowsParsed: 0, rowsChanged: 0, error: String(e) });
  }

  async function done(result: RunOutcome): Promise<RunOutcome> {
    await env.DB.prepare(
      `INSERT INTO crawl_runs
         (source_id, config_version, started_at, duration_ms, status, rows_parsed, rows_changed, error)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
    )
      .bind(
        job.sourceId,
        job.version,
        now,
        Date.now() - startedAt,
        result.status,
        result.rowsParsed,
        result.rowsChanged,
        result.error ?? null,
      )
      .run();
    return result;
  }
}

/// Nhánh giá trong nước: map nhãn → product, validate, publish/quarantine.
async function runDomestic(
  env: Bindings,
  sourceId: string,
  rows: ExtractedRow[],
  now: number,
): Promise<RunOutcome> {
  // Cập nhật source_mappings: thấy nhãn nào thì lưu, nhãn mới → pending.
  await upsertMappings(env.DB, sourceId, rows, now);

  const mappings = await env.DB.prepare(
    "SELECT raw_key, product_id, status FROM source_mappings WHERE source_id = ? AND status = 'mapped'",
  )
    .bind(sourceId)
    .all<MappingRow>();

  const keyToProduct = new Map<string, string>();
  for (const m of mappings.results) {
    if (m.product_id) keyToProduct.set(m.raw_key, m.product_id);
  }

  // Chỉ xét các dòng domestic có cả buy & sell và đã map.
  const candidates = rows
    .filter((r) => r.buy !== undefined && r.sell !== undefined && keyToProduct.has(r.rawKey))
    .map((r) => ({ productId: keyToProduct.get(r.rawKey)!, buy: r.buy!, sell: r.sell! }));

  if (candidates.length === 0) {
    return { status: 'ok', rowsParsed: rows.length, rowsChanged: 0 };
  }

  const productIds = [...new Set(candidates.map((c) => c.productId))];
  const [products, latest] = await Promise.all([
    loadProducts(env.DB, productIds),
    loadLatest(env.DB, productIds),
  ]);

  const toPublish: PublishRow[] = [];
  const toTouch: string[] = [];
  const quarantined: { productId: string; buy: number; sell: number; reason: string }[] = [];

  for (const cand of candidates) {
    const product = products.get(cand.productId);
    if (!product) continue;
    const prev = latest.get(cand.productId) ?? null;
    const d: Decision = decide(
      { maxSpreadPct: product.max_spread_pct, maxChangePct: product.max_change_pct },
      prev,
      { buy: cand.buy, sell: cand.sell },
    );

    if (d.action === 'publish') toPublish.push(cand);
    else if (d.action === 'skip') toTouch.push(cand.productId);
    else quarantined.push({ ...cand, reason: d.reason });
  }

  await publishDomestic(env.DB, sourceId, toPublish, now);
  await touchChecked(env.DB, toTouch, now);
  if (quarantined.length > 0) await insertReviews(env.DB, sourceId, quarantined, latest, now);

  if (toPublish.length > 0) await refreshLatestSnapshot(env);

  const status = quarantined.length > 0 ? 'quarantined' : 'ok';
  return { status, rowsParsed: rows.length, rowsChanged: toPublish.length };
}

/// Nhánh world/fx: fx ghi symbol tỷ giá; world ghi giá kim loại + tỷ giá hiện có.
async function runWorld(
  env: Bindings,
  kind: 'world' | 'fx',
  rows: ExtractedRow[],
  now: number,
): Promise<RunOutcome> {
  if (kind === 'fx') {
    // Dòng có price = tỷ giá USD→VND. Lưu dưới symbol 'USDVND'.
    const rate = rows.find((r) => r.price !== undefined)?.price;
    if (rate === undefined) return { status: 'failed', rowsParsed: rows.length, rowsChanged: 0, error: 'no fx rate' };
    await publishWorld(env.DB, [{ symbol: 'USDVND', priceUsd: rate, usdVnd: rate }], now);
    return { status: 'ok', rowsParsed: rows.length, rowsChanged: 1 };
  }

  // world: cần tỷ giá USD→VND mới nhất để tính usd_vnd quy đổi.
  const usdVnd = await latestUsdVnd(env.DB);
  const worldRows: WorldRow[] = rows
    .filter((r) => r.price !== undefined)
    .map((r) => ({ symbol: r.label.toUpperCase(), priceUsd: r.price!, usdVnd: usdVnd ?? 0 }));

  if (worldRows.length === 0) {
    return { status: 'failed', rowsParsed: rows.length, rowsChanged: 0, error: 'no world prices' };
  }
  const changed = await publishWorld(env.DB, worldRows, now);
  return { status: 'ok', rowsParsed: rows.length, rowsChanged: changed };
}

async function latestUsdVnd(db: D1Database): Promise<number | null> {
  const row = await db
    .prepare("SELECT usd_vnd FROM world_ticks WHERE symbol = 'USDVND' ORDER BY recorded_at DESC LIMIT 1")
    .first<{ usd_vnd: number }>();
  return row?.usd_vnd ?? null;
}

async function upsertMappings(
  db: D1Database,
  sourceId: string,
  rows: ExtractedRow[],
  now: number,
): Promise<void> {
  const domestic = rows.filter((r) => r.buy !== undefined && r.sell !== undefined);
  if (domestic.length === 0) return;
  const stmts = domestic.map((r) =>
    db
      .prepare(
        `INSERT INTO source_mappings (source_id, raw_key, status, sample_buy, sample_sell, last_seen_at)
         VALUES (?1, ?2, 'pending', ?3, ?4, ?5)
         ON CONFLICT (source_id, raw_key) DO UPDATE SET
           sample_buy = excluded.sample_buy,
           sample_sell = excluded.sample_sell,
           last_seen_at = excluded.last_seen_at`,
      )
      .bind(sourceId, r.rawKey, r.buy!, r.sell!, now),
  );
  await db.batch(stmts);
}

async function loadProducts(db: D1Database, ids: string[]): Promise<Map<string, ProductRow>> {
  const map = new Map<string, ProductRow>();
  if (ids.length === 0) return map;
  const placeholders = ids.map((_, i) => `?${i + 1}`).join(',');
  const { results } = await db
    .prepare(
      `SELECT id, max_spread_pct, max_change_pct FROM products WHERE active = 1 AND id IN (${placeholders})`,
    )
    .bind(...ids)
    .all<{ id: string; max_spread_pct: number; max_change_pct: number }>();
  for (const r of results) map.set(r.id, r);
  return map;
}

async function loadLatest(db: D1Database, ids: string[]): Promise<Map<string, LatestRow>> {
  const map = new Map<string, LatestRow>();
  if (ids.length === 0) return map;
  const placeholders = ids.map((_, i) => `?${i + 1}`).join(',');
  const { results } = await db
    .prepare(`SELECT product_id, buy, sell FROM latest_prices WHERE product_id IN (${placeholders})`)
    .bind(...ids)
    .all<LatestRow>();
  for (const r of results) map.set(r.product_id, r);
  return map;
}

async function insertReviews(
  db: D1Database,
  sourceId: string,
  items: { productId: string; buy: number; sell: number; reason: string }[],
  latest: Map<string, LatestRow>,
  now: number,
): Promise<void> {
  // Review cũ cùng product chuyển 'superseded' trước khi thêm mới.
  const stmts: D1PreparedStatement[] = [];
  for (const it of items) {
    stmts.push(
      db
        .prepare(
          "UPDATE price_reviews SET status = 'superseded' WHERE product_id = ? AND status = 'pending'",
        )
        .bind(it.productId),
      db
        .prepare(
          `INSERT INTO price_reviews
             (product_id, source_id, buy, sell, prev_buy, prev_sell, reason, status, created_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'pending', ?8)`,
        )
        .bind(
          it.productId,
          sourceId,
          it.buy,
          it.sell,
          latest.get(it.productId)?.buy ?? null,
          latest.get(it.productId)?.sell ?? null,
          it.reason,
          now,
        ),
    );
  }
  await db.batch(stmts);
}
