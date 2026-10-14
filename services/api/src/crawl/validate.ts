export interface PriceInput {
  buy: number;
  sell: number;
}

export interface ProductLimits {
  maxSpreadPct: number;
  maxChangePct: number;
}

export type Decision =
  | { action: 'publish' }
  | { action: 'skip' } // không đổi so với giá hiện tại
  | { action: 'quarantine'; reason: string };

/// Quyết định cho một giá mới của sản phẩm trong nước, so với giá trước đó.
/// Hàm thuần, không chạm D1 — dễ test.
export function decide(
  limits: ProductLimits,
  prev: PriceInput | null,
  next: PriceInput,
): Decision {
  if (!Number.isFinite(next.buy) || !Number.isFinite(next.sell)) {
    return { action: 'quarantine', reason: 'invalid_number' };
  }
  if (next.buy <= 0 || next.sell <= 0 || next.sell < next.buy) {
    return { action: 'quarantine', reason: 'invalid_range' };
  }

  const spreadPct = ((next.sell - next.buy) / next.sell) * 100;
  if (spreadPct > limits.maxSpreadPct) {
    return { action: 'quarantine', reason: 'spread_exceeded' };
  }

  if (prev) {
    if (prev.buy === next.buy && prev.sell === next.sell) {
      return { action: 'skip' };
    }
    const changeBuy = Math.abs(next.buy - prev.buy) / prev.buy;
    const changeSell = Math.abs(next.sell - prev.sell) / prev.sell;
    const maxChange = limits.maxChangePct / 100;
    if (changeBuy > maxChange || changeSell > maxChange) {
      return { action: 'quarantine', reason: 'change_exceeded' };
    }
  }

  return { action: 'publish' };
}
