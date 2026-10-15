import type { Context } from 'hono';
import type { AdminRole } from './auth/access.ts';

/// Binding của Worker (sinh trong worker-configuration.d.ts qua `wrangler types`).
export type Bindings = Env;

/// Biến gắn vào context sau khi qua middleware auth.
export interface AppVariables {
  adminEmail: string;
  adminRole: AdminRole;
}

export type AppEnv = { Bindings: Bindings; Variables: AppVariables };

export type AppContext = Context<AppEnv>;

/// Message đẩy vào CRAWL_QUEUE: một nguồn đến hạn crawl.
export interface CrawlJob {
  type: 'crawl';
  sourceId: string;
  /// Version cấu hình đang active lúc lên lịch; runner bỏ qua nếu đã đổi.
  version: number;
  at: number;
}
