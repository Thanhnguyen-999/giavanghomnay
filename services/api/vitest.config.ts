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
          isolatedStorage: true,
          wrangler: { configPath: './wrangler.toml' },
          miniflare: {
            compatibilityDate: '2026-10-01',
            compatibilityFlags: ['nodejs_compat'],
            // Truyền danh sách migration vào test qua binding để applyD1Migrations dùng.
            bindings: { TEST_MIGRATIONS: migrations },
          },
        },
      },
    },
  };
});
