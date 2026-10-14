import { parse, type HTMLElement } from 'node-html-parser';
import type { Field } from './config.ts';

export function parseRows(html: string, rowsSelector: string): HTMLElement[] {
  const root = parse(html);
  return root.querySelectorAll(rowsSelector);
}

/// Lấy giá trị một field trong phạm vi một dòng (phần tử hàng).
export function selectField(row: HTMLElement, field: Field): string | undefined {
  const el = row.querySelector(field.path);
  if (!el) return undefined;

  let value = field.attr ? el.getAttribute(field.attr) : el.text;
  if (value == null) return undefined;
  value = value.trim();

  if (field.regex) {
    const m = value.match(new RegExp(field.regex));
    if (!m) return undefined;
    value = (m[1] ?? m[0]).trim();
  }
  return value;
}
