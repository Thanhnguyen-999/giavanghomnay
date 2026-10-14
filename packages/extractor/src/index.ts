import type { Field, SourceConfig } from './config.ts';
import { selectList, selectValue } from './json.ts';
import { parseNumber } from './number.ts';
import { buildRawKey } from './rawkey.ts';
import type { ExtractResult, ExtractedRow } from './types.ts';
import { xmlToJson } from './xml.ts';

export { parseSourceConfig, SourceConfig } from './config.ts';
export type { SourceConfigInput } from './config.ts';
export type { ExtractResult, ExtractedRow } from './types.ts';

type ReadFn = (field: Field) => string | undefined;

/// Trích danh sách dòng giá từ body theo cấu hình. KHÔNG ném vì dữ liệu xấu:
/// dòng thiếu/hỏng được bỏ qua và ghi vào `warnings`. Chỉ ném khi `config` sai.
///
/// Bất đồng bộ vì bộ parse HTML (node-html-parser) được nạp động: chỉ nguồn
/// `format: 'html'` mới kéo thư viện đó vào, nên nhánh JSON/XML không phụ thuộc nó.
export async function extract(config: SourceConfig, body: string): Promise<ExtractResult> {
  const rows: ExtractedRow[] = [];
  const warnings: string[] = [];

  const readers =
    config.format === 'html'
      ? await htmlReaders(config, body, warnings)
      : jsonReaders(config, body, warnings);

  if (!readers) return { rows, warnings };

  let index = 0;
  for (const read of readers) {
    index += 1;
    const label = read(config.fields.label);
    if (!label) {
      warnings.push(`Dòng ${index}: thiếu label, bỏ qua`);
      continue;
    }
    const region = config.fields.region ? read(config.fields.region) : undefined;

    const row: ExtractedRow = {
      rawKey: buildRawKey(config.keyTemplate, { label, region }),
      label,
      region,
    };

    const buy = numField(config, read, 'buy');
    const sell = numField(config, read, 'sell');
    const price = numField(config, read, 'price');

    if (buy !== null) row.buy = buy;
    if (sell !== null) row.sell = sell;
    if (price !== null) row.price = price;

    if (row.buy === undefined && row.sell === undefined && row.price === undefined) {
      warnings.push(`Dòng ${index} (${label}): không đọc được giá, bỏ qua`);
      continue;
    }
    rows.push(row);
  }

  return { rows, warnings };
}

function numField(
  config: SourceConfig,
  read: ReadFn,
  key: 'buy' | 'sell' | 'price',
): number | null {
  const field = config.fields[key];
  if (!field) return null;
  const raw = read(field);
  if (raw === undefined) return null;
  return parseNumber(raw, config.number);
}

async function htmlReaders(
  config: SourceConfig,
  body: string,
  warnings: string[],
): Promise<ReadFn[] | null> {
  let html: typeof import('./html.ts');
  try {
    html = await import('./html.ts');
  } catch (e) {
    warnings.push(`Không nạp được bộ parse HTML: ${String(e)}`);
    return null;
  }

  let elements;
  try {
    elements = html.parseRows(body, config.rows);
  } catch (e) {
    warnings.push(`Không parse được HTML: ${String(e)}`);
    return null;
  }
  if (elements.length === 0) warnings.push(`Selector "${config.rows}" không khớp dòng nào`);
  return elements.map((el) => (field: Field) => html.selectField(el, field));
}

function jsonReaders(config: SourceConfig, body: string, warnings: string[]): ReadFn[] | null {
  let root: unknown;
  try {
    root = config.format === 'xml' ? xmlToJson(body) : JSON.parse(body);
  } catch (e) {
    warnings.push(`Không parse được ${config.format.toUpperCase()}: ${String(e)}`);
    return null;
  }
  const list = selectList(root, config.rows);
  if (list.length === 0) warnings.push(`Đường dẫn "${config.rows}" không trỏ tới dòng nào`);
  return list.map((node) => (field: Field) => {
    const raw = selectValue(node, field.path);
    if (raw === undefined || !field.regex) return raw;
    const m = raw.match(new RegExp(field.regex));
    return m ? (m[1] ?? m[0]) : undefined;
  });
}
