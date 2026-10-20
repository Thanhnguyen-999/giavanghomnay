import { createMiddleware } from 'hono/factory';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { ApiError } from '../lib/errors.ts';
import type { AppEnv } from '../types.ts';

export type AdminRole = 'viewer' | 'editor' | 'owner';

const RANK: Record<AdminRole, number> = { viewer: 1, editor: 2, owner: 3 };

// JWKS cache theo team domain (module-scope, tái dùng giữa request).
let jwksUrl: string | undefined;
let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

function getJwks(teamDomain: string) {
  const url = `${teamDomain}/cdn-cgi/access/certs`;
  if (!jwks || jwksUrl !== url) {
    jwks = createRemoteJWKSet(new URL(url));
    jwksUrl = url;
  }
  return jwks;
}

/// So sánh chuỗi theo thời gian hằng (không rò rỉ độ dài khớp qua thời gian).
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i]! ^ bb[i]!;
  return diff === 0;
}

/// Lấy email đã xác thực từ request.
/// - dev (ENVIRONMENT=dev + ADMIN_DEV_EMAIL): dùng email đó, bỏ qua Access.
/// - production: bắt buộc verify Cf-Access-Jwt-Assertion.
/// Fail-closed: ADMIN_DEV_EMAIL chỉ có tác dụng khi ENVIRONMENT=dev.
async function authenticate(
  env: Env,
  token: string | undefined,
  devEmailHeader: string | undefined,
  adminTokenHeader: string | undefined,
): Promise<string> {
  // wrangler types suy ENVIRONMENT thành literal "production"; đọc rộng để so với "dev".
  const cfg = env as unknown as {
    ENVIRONMENT: string;
    ACCESS_TEAM_DOMAIN: string;
    ACCESS_AUD: string;
    ADMIN_DEV_EMAIL?: string;
    ADMIN_TOKEN?: string;
    ADMIN_TOKEN_EMAIL?: string;
  };

  if (cfg.ENVIRONMENT === 'dev') {
    // Local/test: email lấy từ header X-Dev-Email nếu có, nếu không thì ADMIN_DEV_EMAIL.
    // Chỉ hiệu lực khi ENVIRONMENT=dev; production bỏ qua nhánh này.
    const devEmail = devEmailHeader ?? cfg.ADMIN_DEV_EMAIL;
    if (devEmail) return devEmail.toLowerCase();
  }

  // Xác thực tạm bằng secret token (dùng khi chưa gắn được Cloudflare Access, vd trên workers.dev).
  // Khi ADMIN_TOKEN được cấu hình, token LÀ cơ chế auth: thiếu hoặc sai token đều trả 401
  // (để UI hiện màn nhập token), không rơi xuống nhánh Access.
  if (cfg.ADMIN_TOKEN) {
    if (
      adminTokenHeader &&
      cfg.ADMIN_TOKEN_EMAIL &&
      timingSafeEqual(adminTokenHeader, cfg.ADMIN_TOKEN)
    ) {
      return cfg.ADMIN_TOKEN_EMAIL.toLowerCase();
    }
    throw new ApiError('unauthorized', 'Cần token quản trị hợp lệ', 401);
  }

  if (!cfg.ACCESS_TEAM_DOMAIN || !cfg.ACCESS_AUD) {
    throw new ApiError('config_error', 'Chưa cấu hình xác thực quản trị (Access hoặc token)', 500);
  }
  if (!token) throw new ApiError('unauthorized', 'Thiếu Access token', 401);

  try {
    const { payload } = await jwtVerify(token, getJwks(cfg.ACCESS_TEAM_DOMAIN), {
      issuer: cfg.ACCESS_TEAM_DOMAIN,
      audience: cfg.ACCESS_AUD,
    });
    const email = String(payload.email ?? '').toLowerCase();
    if (!email) throw new Error('token thiếu email');
    return email;
  } catch {
    throw new ApiError('unauthorized', 'Access token không hợp lệ', 401);
  }
}

/// Middleware: xác thực admin + yêu cầu role tối thiểu. Set biến `adminEmail`, `adminRole`.
export function requireAdmin(minRole: AdminRole) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const token = c.req.header('Cf-Access-Jwt-Assertion');
    const email = await authenticate(
      c.env,
      token,
      c.req.header('X-Dev-Email'),
      c.req.header('X-Admin-Token'),
    );

    const admin = await c.env.DB.prepare(
      'SELECT role FROM admins WHERE email = ? AND active = 1',
    )
      .bind(email)
      .first<{ role: AdminRole }>();

    if (!admin || RANK[admin.role] < RANK[minRole]) {
      throw new ApiError('forbidden', 'Không đủ quyền', 403);
    }

    c.set('adminEmail', email);
    c.set('adminRole', admin.role);
    await next();
  });
}
