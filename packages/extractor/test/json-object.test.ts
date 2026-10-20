import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { parseSourceConfig } from '../src/config.ts';
import { extract } from '../src/index.ts';

function fixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8');
}

describe('extract: JSON object-of-objects (vang.today)', () => {
  const config = parseSourceConfig({
    request: { url: 'https://www.vang.today/api/prices' },
    format: 'json',
    rows: 'prices[*]', // wildcard duyệt value của object `prices`
    fields: {
      label: { path: '$key' }, // type_code làm nhãn
      buy: { path: 'buy' },
      sell: { path: 'sell' },
    },
    number: { thousandSeparator: '.', decimalSeparator: ',', multiplier: 1 },
    keyTemplate: '{label}',
  });

  test('đọc được từng loại vàng theo type_code', async () => {
    const { rows } = await extract(config, fixture('vang-today-prices.json'));
    // 3 loại trong fixture, nhưng XAUUSD có sell=0 → vẫn parse được (buy>0).
    const sjc = rows.find((r) => r.label === 'SJL1L10');
    expect(sjc).toMatchObject({ buy: 139_600_000, sell: 142_600_000 });
    const ring = rows.find((r) => r.label === 'SJ9999');
    expect(ring).toMatchObject({ buy: 137_700_000, sell: 141_200_000 });
    expect(sjc?.rawKey).toBe('sjl1l10');
  });
});
