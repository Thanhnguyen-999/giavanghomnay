import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { AppContext } from '../types.ts';

/// Lỗi có mã ổn định để client xử lý; message để hiển thị.
export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: ContentfulStatusCode = 400,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, code = 'invalid_input') =>
  new ApiError(code, message, 400);
export const notFound = (message = 'Not found', code = 'not_found') =>
  new ApiError(code, message, 404);

/// Chuẩn hóa mọi lỗi về { error: { code, message } }.
export function errorResponse(c: AppContext, err: unknown): Response {
  if (err instanceof ApiError) {
    return c.json({ error: { code: err.code, message: err.message } }, err.status);
  }
  console.error('Unhandled error:', err);
  return c.json({ error: { code: 'internal', message: 'Internal error' } }, 500);
}
