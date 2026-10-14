import type { SourceConfig } from '@giavang/extractor/config';

const APP_UA = 'GiaVangHomNay/1.0 (+https://thanhnguyen-999.github.io/)';

export interface FetchResult {
  body: string;
  status: number;
  contentType: string | null;
}

/// Hostname bị chặn để tránh SSRF: nội bộ, loopback, dải private/link-local.
function isBlockedHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.internal')) return true;
  if (h === '0.0.0.0' || h === '::1' || h === '[::1]') return true;

  // IPv4 literal trong dải riêng tư.
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10 || a === 127) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 169 && b === 254) return true; // link-local
  }
  return false;
}

/// Fetch an toàn theo cấu hình nguồn: chỉ https, chặn host nội bộ, timeout,
/// và cắt body theo maxBytes (đọc stream, dừng khi vượt).
export async function safeFetch(request: SourceConfig['request']): Promise<FetchResult> {
  const url = new URL(request.url);
  if (url.protocol !== 'https:') throw new Error(`Chỉ cho phép https: ${request.url}`);
  if (isBlockedHost(url.hostname)) throw new Error(`Hostname bị chặn: ${url.hostname}`);

  const headers = new Headers(request.headers);
  if (!headers.has('User-Agent')) headers.set('User-Agent', APP_UA);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json, text/html, */*');

  const res = await fetch(url, {
    method: request.method,
    headers,
    body: request.method === 'POST' ? (request.body ?? null) : null,
    signal: AbortSignal.timeout(request.timeoutMs),
    redirect: 'follow',
  });

  const body = await readCapped(res, request.maxBytes);
  return { body, status: res.status, contentType: res.headers.get('content-type') };
}

/// Đọc body nhưng dừng khi vượt maxBytes (tránh nuốt response khổng lồ).
async function readCapped(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > maxBytes) throw new Error(`Response vượt ${maxBytes} byte`);
        chunks.push(value);
      }
    }
  } finally {
    reader.releaseLock();
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const ch of chunks) {
    merged.set(ch, offset);
    offset += ch.byteLength;
  }
  return new TextDecoder('utf-8').decode(merged);
}
