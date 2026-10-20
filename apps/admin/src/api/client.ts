// Gọi API admin. Admin SPA và API cùng origin (API Worker phục vụ luôn SPA tại /admin),
// nên dùng path tương đối. Dev: vite proxy sang Worker kèm X-Dev-Email.
// Production: xác thực bằng secret token (header X-Admin-Token) cho tới khi gắn Cloudflare Access.
const API_BASE = '';
const TOKEN_KEY = 'admin_token';

export function getAdminToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? '';
}
export function setAdminToken(token: string): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body) headers['Content-Type'] = 'application/json';
  const token = getAdminToken();
  if (token) headers['X-Admin-Token'] = token;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: 'include',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const err = (json as { error?: { code: string; message: string } }).error;
    throw new ApiError(res.status, err?.code ?? 'error', err?.message ?? `HTTP ${res.status}`);
  }
  return (json as { data: T }).data;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};
