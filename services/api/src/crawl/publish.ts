import { vnDay } from '../lib/time.ts';

export interface PublishRow {
  productId: string;
  buy: number;
  sell: number;
}

/// Ghi các giá đã validate vào D1 trong một batch:
///  - price_ticks  (lịch sử, chỉ dòng mới)
///  - latest_prices (upsert, dời buy→prev_buy)
///  - price_daily  (OHLC theo ngày giờ VN)
/// Trả số câu lệnh đã chạy (0 nếu không có gì để ghi).
export async function publishDomestic(
  db: D1Database,
  sourceId: string,
  rows: PublishRow[],
  now: number,
): Promise<number> {
  if (rows.length === 0) return 0;
  const day = vnDay(now);
  const stmts: D1PreparedStatement[] = [];

  for (const r of rows) {
    stmts.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO price_ticks (product_id, recorded_at, buy, sell, source_id)
           VALUES (?1, ?2, ?3, ?4, ?5)`,
        )
        .bind(r.productId, now, r.buy, r.sell, sourceId),

      db
        .prepare(
          `INSERT INTO latest_prices (product_id, buy, sell, changed_at, checked_at, source_id)
           VALUES (?1, ?2, ?3, ?4, ?4, ?5)
           ON CONFLICT (product_id) DO UPDATE SET
             prev_buy   = latest_prices.buy,
             prev_sell  = latest_prices.sell,
             buy        = excluded.buy,
             sell       = excluded.sell,
             changed_at = excluded.changed_at,
             checked_at = excluded.checked_at,
             source_id  = excluded.source_id`,
        )
        .bind(r.productId, r.buy, r.sell, now, sourceId),

      db
        .prepare(
          `INSERT INTO price_daily
             (product_id, day, open_sell, high_sell, low_sell, close_sell, close_buy)
           VALUES (?1, ?2, ?3, ?3, ?3, ?3, ?4)
           ON CONFLICT (product_id, day) DO UPDATE SET
             high_sell  = MAX(high_sell, excluded.close_sell),
             low_sell   = MIN(low_sell, excluded.close_sell),
             close_sell = excluded.close_sell,
             close_buy  = excluded.close_buy`,
        )
        .bind(r.productId, day, r.sell, r.buy),
    );
  }

  await db.batch(stmts);
  return stmts.length;
}

/// Chỉ cập nhật checked_at (giá không đổi) — để biết nguồn vẫn sống.
export async function touchChecked(
  db: D1Database,
  productIds: string[],
  now: number,
): Promise<void> {
  if (productIds.length === 0) return;
  const stmts = productIds.map((id) =>
    db.prepare('UPDATE latest_prices SET checked_at = ?2 WHERE product_id = ?1').bind(id, now),
  );
  await db.batch(stmts);
}

export interface WorldRow {
  symbol: string;
  priceUsd: number;
  usdVnd: number;
}

/// Ghi giá thế giới vào world_ticks (một dòng/symbol/lần).
export async function publishWorld(
  db: D1Database,
  rows: WorldRow[],
  now: number,
): Promise<number> {
  if (rows.length === 0) return 0;
  const stmts = rows.map((r) =>
    db
      .prepare(
        `INSERT OR REPLACE INTO world_ticks (symbol, recorded_at, price_usd, usd_vnd)
         VALUES (?1, ?2, ?3, ?4)`,
      )
      .bind(r.symbol, now, r.priceUsd, r.usdVnd),
  );
  await db.batch(stmts);
  return stmts.length;
}
