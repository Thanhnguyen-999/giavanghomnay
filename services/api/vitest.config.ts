import { readD1Migrations } from '@cloudflare/vitest-pool-workers/config';
import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';
import { fileURLToPath } from 'node:url';

const migrationsPath = fileURLToPath(new URL('./migrations', import.meta.url));

export default defineWorkersConfig(async () => {
  const migrations = await readD1Migrations(migrationsPath);

  return {
    test: {
      include: ['test/**/*.test.ts'],
      poolOptions: {
        workers: {
          // isolatedStorage: mỗi test có storage riêng (rollback sau mỗi test).
          // Cần bật để tránh ERR_MULTIPLE_CONSUMERS khi nhiều file test chung queue.
          // Hệ quả: mỗi test() phải tự tạo dữ liệu nó cần, không dựa vào test trước.
          isolatedStorage: true,
          wrangler: { configPath: './wrangler.toml' },
          miniflare: {
            compatibilityDate: '2026-10-01',
            compatibilityFlags: ['nodejs_compat'],
            // Truyền migrations + bật dev-mode để test auth bằng header X-Dev-Email.
            bindings: {
              TEST_MIGRATIONS: migrations,
              ENVIRONMENT: 'dev',
              ADMIN_DEV_EMAIL: '',
              ACCESS_TEAM_DOMAIN: '',
              ACCESS_AUD: '',
            },
          },
        },
      },
    },
  };
});
