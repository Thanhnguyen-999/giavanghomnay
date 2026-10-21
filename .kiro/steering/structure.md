# Project Structure

Monorepo. TypeScript packages are pnpm workspaces (`pnpm-workspace.yaml`); the Flutter app is outside pnpm.

```
giavanghomnay/
├── apps/
│   ├── mobile/          # Flutter (Android/iOS)
│   ├── web/             # Astro static site → GitHub Pages
│   └── admin/           # React + Vite SPA → Workers static assets
├── services/
│   └── api/             # Cloudflare Worker "gold-api"
├── packages/
│   ├── shared/          # zod schemas + types shared by api/web/admin
│   └── extractor/       # pure-TS price extraction engine
├── ai_docs/             # architecture + phase docs (design source of truth)
├── docs/openapi.json    # generated from zod; contract for Flutter
└── .github/workflows/   # CI: backend.yml, admin.yml, mobile.yml
```

## API — `services/api/src`

- `index.ts` — Worker entry: `export default { fetch, scheduled, queue }`.
- `routes/` — grouped by audience:
  - `public/` — `/v1/*` anonymous read (products, prices, world, news).
  - `me/` — `/v1/me/*` logged-in user (profile, devices, favorites, alerts).
  - `admin/` — `/admin/v1/*` admin (brands, products, sources, mappings, reviews, ...).
- `crawl/` — scheduler, job runner, publish, quarantine.
- `alerts/` — price-alert evaluation + FCM.
- `auth/` — `firebase.ts` (user ID tokens), `access.ts` (Cloudflare Access).
- `lib/` — shared helpers. `types.ts` — `Env` / `AppEnv` bindings.
- `migrations/` — D1 migrations. `seed/` — dev/seed SQL. `test/` — vitest.

## Mobile — `apps/mobile/lib`

Feature-first layout:

- `main.dart` — entry point.
- `app/` — app shell, routing, tabs.
- `core/` — cross-cutting infrastructure (config, networking, storage).
- `shared/` — shared widgets/models used across features.
- `features/` — one folder per feature: `prices/`, `world/`, `chart/`, `account/`.

## Where things belong

- **Shared validation/types** → `packages/shared`; never duplicate schemas per client.
- **Price parsing logic** → `packages/extractor` (keep it free of Workers/Flutter APIs).
- **New API endpoint** → a route file under the matching `routes/{public,me,admin}` group, with its zod schema in `packages/shared`.
- **New price source** → added as data via the admin dashboard (config is versioned in D1), not as new code.
- **Architecture decisions / phase plans** → `ai_docs/` (read these before large changes).

## Naming / identifiers

- Entity IDs are slug-like strings (e.g. brand `sjc`, product `sjc-bar-1l-hcm`).
- TypeScript packages use the `@giavang/*` scope (`@giavang/api`, `@giavang/admin`, `@giavang/shared`, `@giavang/extractor`).
