import { describe, expect, test } from 'vitest';
import { parseNumber } from '../src/number.ts';

const vn = { thousandSeparator: '.' as const, decimalSeparator: ',' as const, multiplier: 1 };

describe('parseNumber', () => {
  test('kiểu Việt Nam: nghìn ngăn bằng chấm', () => {
    expect(parseNumber('128.500', vn)).toBe(128500);
    expect(parseNumber('1.235.000', vn)).toBe(1235000);
  });

  test('bỏ ký hiệu tiền và khoảng trắng', () => {
    expect(parseNumber('₫ 120.500 đ', vn)).toBe(120500);
    expect(parseNumber('  130.500  ', vn)).toBe(130500);
  });

  test('phần thập phân bằng dấu phẩy', () => {
    expect(parseNumber('25.897,06', vn)).toBeCloseTo(25897.06);
  });

  test('multiplier đưa về đồng/lượng', () => {
    // "nghìn đồng/lượng" → ×1000
    expect(parseNumber('128.500', { ...vn, multiplier: 1000 })).toBe(128500000);
    // "nghìn đồng/chỉ" → ×10000 (1 lượng = 10 chỉ)
    expect(parseNumber('12.850', { ...vn, multiplier: 10000 })).toBe(128500000);
  });

  test('kiểu quốc tế: nghìn ngăn bằng phẩy, thập phân bằng chấm', () => {
    const us = { thousandSeparator: ',' as const, decimalSeparator: '.' as const, multiplier: 1 };
    expect(parseNumber('4,152.00', us)).toBeCloseTo(4152);
    expect(parseNumber('1,235.5', us)).toBeCloseTo(1235.5);
  });

  test('rỗng hoặc không có số → null', () => {
    expect(parseNumber('', vn)).toBeNull();
    expect(parseNumber('N/A', vn)).toBeNull();
    expect(parseNumber('—', vn)).toBeNull();
  });

  test('số âm giữ dấu', () => {
    expect(parseNumber('-12.000', vn)).toBe(-12000);
  });
});
