import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { runCrawlJob } from './crawl/runner.ts';
import { scheduleDueSources } from './crawl/scheduler.ts';
import { errorResponse } from './lib/errors.ts';
import { nowSec } from './lib/time.ts';
import { adminRoutes } from './routes/admin/index.ts';
import { health } from './routes/health.ts';
import { publicRoutes } from './routes/public.ts';
import type { AppEnv, CrawlJob } from './types.ts';

const app = new Hono<AppEnv>();

// CORS cho web công khai (GET). Mobile không gửi Origin nên không ảnh hưởng.
app.use('/v1/*', async (c, next) => {
  const allowed = c.env.CORS_ORIGINS.split(',').map((o) => o.trim());
  return cors({
    origin: (origin) => (allowed.includes(origin) ? origin : null),
    allowMethods: ['GET'],
  })(c, next);
});

// CORS cho admin SPA: cho phép mọi method ghi + header Access, kèm credentials (cookie Access).
app.use('/admin/v1/*', async (c, next) => {
  const allowed = c.env.CORS_ORIGINS.split(',').map((o) => o.trim());
  return cors({
    origin: (origin) => (allowed.includes(origin) ? origin : null),
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowHeaders: ['Content-Type', 'Cf-Access-Jwt-Assertion'],
    credentials: true,
  })(c, next);
});

app.route('/', health);
app.route('/v1', publicRoutes);
app.route('/admin/v1', adminRoutes);

app.notFound((c) => c.json({ error: { code: 'not_found', message: 'Not found' } }, 404));
app.onError((err, c) => errorResponse(c, err));

export default {
  fetch: app.fetch,

  // Cron mỗi phút: lên lịch các nguồn đến hạn.
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(scheduleDueSources(env.DB, env.CRAWL_QUEUE, nowSec()));
  },

  // Consumer CRAWL_QUEUE: mỗi message = 1 nguồn.
  async queue(batch: MessageBatch<CrawlJob>, env: Env): Promise<void> {
    for (const msg of batch.messages) {
      try {
        await runCrawlJob(env, msg.body);
        msg.ack(); // runCrawlJob tự nuốt lỗi logic & ghi crawl_runs; chỉ lỗi hạ tầng mới ném.
      } catch (e) {
        console.error('crawl job failed, will retry:', e);
        msg.retry();
      }
    }
  },
} satisfies ExportedHandler<Env, CrawlJob>;
