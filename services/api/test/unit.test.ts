import { describe, expect, test } from 'vitest';
import { decide } from '../src/crawl/validate.ts';
import { isHistoryRange, usesTicks, vnDay } from '../src/lib/time.ts';

describe('validate.decide', () => {
  const limits = { maxSpreadPct: 10, maxChangePct: 5 };

  test('giá hợp lệ, chưa có giá trước → publish', () => {
    expect(decide(limits, null, { buy: 128_000_000, sell: 130_000_000 })).toEqual({
      action: 'publish',
    });
  });

  test('sell < buy → quarantine invalid_range', () => {
    expect(decide(limits, null, { buy: 130_000_000, sell: 128_000_000 })).toEqual({
      action: 'quarantine',
      reason: 'invalid_range',
    });
  });

  test('spread quá rộng → quarantine spread_exceeded', () => {
    // spread 20% > 10%
    expect(decide(limits, null, { buy: 100_000_000, sell: 125_000_000 })).toEqual({
      action: 'quarantine',
      reason: 'spread_exceeded',
    });
  });

  test('biến động quá lớn so với giá trước → quarantine change_exceeded', () => {
    const prev = { buy: 100_000_000, sell: 102_000_000 };
    // sell tăng ~18% > 5%
    expect(decide(limits, prev, { buy: 118_000_000, sell: 120_000_000 }).action).toBe(
      'quarantine',
    );
  });

  test('giá y hệt lần trước → skip', () => {
    const prev = { buy: 128_000_000, sell: 130_000_000 };
    expect(decide(limits, prev, { ...prev })).toEqual({ action: 'skip' });
  });

  test('đổi nhẹ trong ngưỡng → publish', () => {
    const prev = { buy: 128_000_000, sell: 130_000_000 };
    expect(decide(limits, prev, { buy: 128_500_000, sell: 130_500_000 })).toEqual({
      action: 'publish',
    });
  });
});

describe('time', () => {
  test('vnDay theo giờ VN (UTC+7)', () => {
    // 2026-10-13T18:30:00Z = 2026-10-14 01:30 giờ VN → ngày 14.
    const utc = Math.floor(Date.UTC(2026, 9, 13, 18, 30, 0) / 1000);
    expect(vnDay(utc)).toBe('2026-10-14');
  });

  test('isHistoryRange & usesTicks', () => {
    expect(isHistoryRange('1d')).toBe(true);
    expect(isHistoryRange('99x')).toBe(false);
    expect(usesTicks('1d')).toBe(true);
    expect(usesTicks('1m')).toBe(false);
  });
});
