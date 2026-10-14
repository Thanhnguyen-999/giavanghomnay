import { describe, expect, test } from 'vitest';
import { buildRawKey, normalize } from '../src/rawkey.ts';

describe('normalize', () => {
  test('bỏ dấu tiếng Việt và chữ đ', () => {
    expect(normalize('Vàng miếng SJC 1L')).toBe('vang mieng sjc 1l');
    expect(normalize('Đồng giá')).toBe('dong gia');
  });

  test('gộp khoảng trắng và ký tự lạ, ổn định với thay đổi nhỏ', () => {
    expect(normalize('Nhẫn SJC  99,99%')).toBe('nhan sjc 99 99');
    expect(normalize('Nhẫn SJC 99.99 %')).toBe('nhan sjc 99 99');
  });
});

describe('buildRawKey', () => {
  test('ghép label và region đã chuẩn hóa', () => {
    expect(buildRawKey('{label}|{region}', { label: 'Vàng SJC 1L', region: 'Hồ Chí Minh' })).toBe(
      'vang sjc 1l|ho chi minh',
    );
  });

  test('region thiếu → chuỗi rỗng sau dấu phân tách', () => {
    expect(buildRawKey('{label}|{region}', { label: 'XAU' })).toBe('xau|');
  });
});
