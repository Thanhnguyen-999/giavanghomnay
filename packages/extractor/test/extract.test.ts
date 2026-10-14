import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { parseSourceConfig } from '../src/config.ts';
import { extract } from '../src/index.ts';

function fixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8');
}

describe('extract: HTML domestic table', () => {
  const config = parseSourceConfig({
    request: { url: 'https://example.com/gia-vang' },
    format: 'html',
    rows: 'table.price-table tbody tr',
    fields: {
      label: { path: 'td.name' },
      region: { path: 'td.name', regex: '\\(([^)]+)\\)' },
      buy: { path: 'td.buy' },
      sell: { path: 'td.sell' },
    },
    number: { thousandSeparator: '.', decimalSeparator: ',', multiplier: 1000 },
    keyTemplate: '{label}|{region}',
  });

  test('doc dung cac dong co gia, bo dong rong', async () => {
    const { rows, warnings } = await extract(config, fixture('domestic-table.html'));

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      label: 'Vàng miếng SJC 1L (Hồ Chí Minh)',
      region: 'Hồ Chí Minh',
      buy: 128_500_000,
      sell: 130_500_000,
    });
    expect(rows[0]?.rawKey).toContain('vang mieng sjc 1l');
    expect(rows[1]).toMatchObject({ buy: 125_200_000, sell: 127_700_000, region: 'Hà Nội' });
    expect(warnings.some((w) => w.includes('không đọc được giá'))).toBe(true);
  });
});

describe('extract: JSON single object (gold-api XAU)', () => {
  const config = parseSourceConfig({
    request: { url: 'https://api.gold-api.com/price/XAU' },
    format: 'json',
    rows: '.',
    fields: {
      label: { path: 'symbol' },
      price: { path: 'price' },
    },
    number: { thousandSeparator: ',', decimalSeparator: '.', multiplier: 1 },
    keyTemplate: '{label}',
  });

  test('doc duoc gia XAU theo USD', async () => {
    const { rows } = await extract(config, fixture('gold-api-xau.json'));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ label: 'XAU', price: 4152 });
  });
});

describe('extract: JSON nested rate (er-api VND)', () => {
  const config = parseSourceConfig({
    request: { url: 'https://open.er-api.com/v6/latest/USD' },
    format: 'json',
    rows: '.',
    fields: {
      label: { path: 'base_code' },
      price: { path: 'rates.VND' },
    },
    number: { thousandSeparator: ',', decimalSeparator: '.', multiplier: 1 },
    keyTemplate: '{label}',
  });

  test('doc duoc ty gia USD->VND', async () => {
    const { rows } = await extract(config, fixture('er-api-usd.json'));
    expect(rows[0]).toMatchObject({ label: 'USD', price: 25897.06 });
  });
});

describe('extract: XML list', () => {
  const config = parseSourceConfig({
    request: { url: 'https://example.com/metals.xml' },
    format: 'xml',
    rows: 'metals.metal[*]',
    fields: {
      label: { path: '@_symbol' },
      price: { path: 'price' },
    },
    number: { thousandSeparator: ',', decimalSeparator: '.', multiplier: 1 },
    keyTemplate: '{label}',
  });

  test('doc duoc danh sach kim loai kem attribute', async () => {
    const { rows } = await extract(config, fixture('metals-list.xml'));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ label: 'XAU', price: 4152 });
    expect(rows[1]).toMatchObject({ label: 'XAG', price: 52.35 });
  });
});

describe('extract: du lieu hong khong lam sap', () => {
  const config = parseSourceConfig({
    request: { url: 'https://example.com' },
    format: 'json',
    rows: 'items[*]',
    fields: { label: { path: 'name' }, price: { path: 'price' } },
  });

  test('JSON sai cu phap -> rows rong + warning', async () => {
    const { rows, warnings } = await extract(config, '{ broken json');
    expect(rows).toHaveLength(0);
    expect(warnings[0]).toContain('Không parse được JSON');
  });

  test('duong dan khong khop -> rows rong + warning', async () => {
    const { rows, warnings } = await extract(config, '{"items":[]}');
    expect(rows).toHaveLength(0);
    expect(warnings.some((w) => w.includes('không trỏ tới dòng nào'))).toBe(true);
  });
});
