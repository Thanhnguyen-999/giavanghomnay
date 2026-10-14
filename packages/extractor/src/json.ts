/// Bộ đọc đường dẫn JSON tối giản, KHÔNG dùng eval.
///
/// Cú pháp hỗ trợ:
///   a.b.c        truy cập thuộc tính
///   items[0]     chỉ số mảng
///   items[*]     mọi phần tử của mảng (dùng cho `rows`)
///
/// `selectList` trả danh sách node (mỗi node là một "dòng").
/// `selectValue` trả một giá trị vô hướng từ một node.

type Json = unknown;

interface Token {
  key?: string;
  index?: number;
  wildcard?: boolean;
}

function tokenize(path: string): Token[] {
  const tokens: Token[] = [];
  // Tách theo '.' nhưng giữ phần [..]; vd 'a.b[0].c' , 'items[*]'.
  for (const segment of path.split('.')) {
    const m = segment.match(/^([^[\]]*)((?:\[[^\]]*\])*)$/);
    if (!m) continue;
    const name = m[1];
    if (name) tokens.push({ key: name });
    const brackets = m[2] ?? '';
    for (const b of brackets.matchAll(/\[([^\]]*)\]/g)) {
      const inner = b[1] ?? '';
      if (inner === '*') tokens.push({ wildcard: true });
      else tokens.push({ index: Number(inner) });
    }
  }
  return tokens;
}

function step(nodes: Json[], token: Token): Json[] {
  const out: Json[] = [];
  for (const node of nodes) {
    if (node == null) continue;
    if (token.wildcard) {
      if (Array.isArray(node)) out.push(...node);
    } else if (token.index !== undefined) {
      if (Array.isArray(node)) {
        const v = node[token.index];
        if (v !== undefined) out.push(v);
      }
    } else if (token.key !== undefined) {
      if (typeof node === 'object' && !Array.isArray(node)) {
        const v = (node as Record<string, Json>)[token.key];
        if (v !== undefined) out.push(v);
      }
    }
  }
  return out;
}

function walk(root: Json, path: string): Json[] {
  let nodes: Json[] = [root];
  for (const token of tokenize(path)) {
    nodes = step(nodes, token);
    if (nodes.length === 0) break;
  }
  return nodes;
}

/// Danh sách node theo path (dùng cho `rows`). path rỗng → [root].
export function selectList(root: Json, path: string): Json[] {
  if (!path) return [root];
  return walk(root, path);
}

/// Một giá trị vô hướng (chuỗi) từ node; number/boolean được ép về chuỗi.
export function selectValue(node: Json, path: string): string | undefined {
  const found = path ? walk(node, path) : [node];
  const v = found[0];
  if (v == null) return undefined;
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return undefined;
}
