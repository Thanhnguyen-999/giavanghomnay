import type { Context } from 'hono';

/// Binding của Worker (sinh trong worker-configuration.d.ts qua `wrangler types`).
export type Bindings = Env;

export type AppEnv = { Bindings: Bindings };

export type AppContext = Context<AppEnv>;

/// Message đẩy vào CRAWL_QUEUE: một nguồn đến hạn crawl.
export interface CrawlJob {
  type: 'crawl';
  sourceId: string;
  /// Version cấu hình đang active lúc lên lịch; runner bỏ qua nếu đã đổi.
  version: number;
  at: number;
}
