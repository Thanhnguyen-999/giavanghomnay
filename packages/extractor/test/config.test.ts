import { describe, expect, test } from 'vitest';
import { parseSourceConfig } from '../src/config.ts';

describe('parseSourceConfig', () => {
  test('điền default cho number và request', () => {
    const c = parseSourceConfig({
      request: { url: 'https://example.com' },
      format: 'json',
      rows: 'items[*]',
      fields: { label: { path: 'name' }, price: { path: 'p' } },
    });
    expect(c.request.method).toBe('GET');
    expect(c.request.timeoutMs).toBe(8000);
    expect(c.number.multiplier).toBe(1);
    expect(c.keyTemplate).toBe('{label}|{region}');
  });

  test('từ chối URL không https', () => {
    expect(() =>
      parseSourceConfig({
        request: { url: 'http://example.com' },
        format: 'json',
        rows: 'x',
        fields: { label: { path: 'n' } },
      }),
    ).toThrow();
  });

  test('từ chối khi hai dấu phân cách trùng nhau', () => {
    expect(() =>
      parseSourceConfig({
        request: { url: 'https://example.com' },
        format: 'json',
        rows: 'x',
        fields: { label: { path: 'n' } },
        number: { thousandSeparator: ',', decimalSeparator: ',' },
      }),
    ).toThrow();
  });
});
