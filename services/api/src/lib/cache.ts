import type { Bindings } from '../types.ts';

const LATEST_KEY = 'prices:latest:v1';

export interface LatestPriceItem {
  product_id: string;
  brand_id: string;
  name: string;
  kind: string;
  region: string | null;
  buy: number;
  sell: number;
  prev_buy: number | null;
  prev_sell: number | null;
  changed_at: number;
  checked_at: number;
  source_id: string;
}

export interface LatestSnapshot {
  updatedAt: number;
  items: LatestPriceItem[];
}

/// Query latest_prices → snapshot. Dùng khi KV miss hoặc khi ghi write-through.
export async function buildLatestFromD1(db: D1Database): Promise<LatestSnapshot> {
  const { results } = await db
    .prepare(
      `SELECT p.id AS product_id, p.brand_id, p.name, p.kind, p.region,
              l.buy, l.sell, l.prev_buy, l.prev_sell, l.changed_at, l.checked_at, l.source_id
         FROM latest_prices l
         JOIN products p ON p.id = l.product_id
         JOIN brands b   ON b.id = p.brand_id
        WHERE p.active = 1 AND b.active = 1
        ORDER BY b.sort_order, p.sort_order`,
    )
    .all<LatestPriceItem>();

  const updatedAt = results.reduce((max, r) => Math.max(max, r.changed_at), 0);
  return { updatedAt, items: results };
}

export async function readLatestSnapshot(env: Bindings): Promise<LatestSnapshot | null> {
  return env.CACHE.get<LatestSnapshot>(LATEST_KEY, 'json');
}

export async function writeLatestSnapshot(env: Bindings, snapshot: LatestSnapshot): Promise<void> {
  await env.CACHE.put(LATEST_KEY, JSON.stringify(snapshot));
}

/// Ghi lại snapshot từ D1 (gọi sau mỗi lần publish có thay đổi, hoặc admin sửa danh mục).
export async function refreshLatestSnapshot(env: Bindings): Promise<LatestSnapshot> {
  const snapshot = await buildLatestFromD1(env.DB);
  await writeLatestSnapshot(env, snapshot);
  return snapshot;
}

/// ETag yếu từ updatedAt + số item. Đổi khi có giá mới hoặc danh mục đổi.
export function etagFor(snapshot: LatestSnapshot): string {
  return `W/"${snapshot.updatedAt}-${snapshot.items.length}"`;
}
