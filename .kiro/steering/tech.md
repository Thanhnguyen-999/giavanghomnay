# Tech Stack

A monorepo split between a **TypeScript** side (managed by pnpm workspaces) and a **Flutter** app (outside pnpm).

## Backend — `services/api`

- **Cloudflare Workers** runtime (`fetch` + `scheduled` + `queue` handlers in `src/index.ts`).
- **Hono** 4.x for routing/middleware.
- **D1** (SQLite) for data + config, **KV** for price snapshots, **R2** for logos/raw HTML, **Queues** for crawl jobs and price alerts.
- **zod** for all request/response validation. **jose** for JWT verification (Firebase ID tokens, Cloudflare Access).
- Config in `wrangler.toml`; local secrets in `.dev.vars` (see `.dev.vars.example`).

## Shared packages — `packages/`

- `packages/extractor` — pure-TS price extraction engine (html/json/xml). No Workers dependency, so it is testable standalone and reused by the crawl job and the admin "dry-run". Uses `node-html-parser`, `fast-xml-parser`, `zod`.
- `packages/shared` — zod schemas + types shared across api/web/admin (e.g. `SourceConfig`). OpenAPI (`docs/openapi.json`) is generated from these schemas and is the contract for Flutter.

## Admin — `apps/admin`

- **React 18 + Vite 5**, TypeScript. Deployed as Workers static assets behind Cloudflare Access.

## Web — `apps/web`

- **Astro** with `output: 'static'`, deployed to GitHub Pages. Prices are hydrated client-side from the API.

## Mobile — `apps/mobile`

- **Flutter** (Dart SDK `^3.8.0`), Android/iOS only.
- **flutter_riverpod** for state, **dio** for HTTP, **shared_preferences** for local cache, **fl_chart** for charts, **intl** for formatting.

## Versions

- **Node 22 LTS** (`.nvmrc`), **pnpm** via `corepack enable` (`packageManager: pnpm@12.11.2`).
- **Flutter 3.38+** (stable).

## Common commands

Run TypeScript commands from the relevant package dir (pnpm workspaces).

### API (`services/api`)

```bash
pnpm dev                    # wrangler dev (local Worker)
pnpm typecheck              # wrangler types && tsc --noEmit
pnpm test                   # vitest run (@cloudflare/vitest-pool-workers)
pnpm deploy                 # wrangler deploy
pnpm db:migrate:local       # apply D1 migrations locally
pnpm db:seed:local          # seed local D1
pnpm db:migrate:remote      # apply D1 migrations to remote
```

### Admin (`apps/admin`)

```bash
pnpm dev                    # vite dev server
pnpm build                  # tsc --noEmit && vite build
pnpm typecheck              # tsc --noEmit
pnpm deploy                 # wrangler deploy
```

### Shared packages

```bash
pnpm test                   # vitest run
pnpm typecheck              # tsc --noEmit
```

### Mobile — from repo root

```bash
npm run mobile:get          # flutter pub get
npm run mobile:run          # flutter run
npm run mobile:analyze      # flutter analyze
npm run mobile:test         # flutter test
```

Mobile build-time config via `--dart-define`:

```bash
flutter run --dart-define=GOLD_API_KEY=<key> --dart-define=API_BASE_URL=https://gold-api.<account>.workers.dev
```

## Conventions

- Validate every API body/query with zod; keep schemas in `packages/shared` so web/admin/OpenAPI stay in sync.
- Keep extraction logic pure and in `packages/extractor` (no Workers APIs) so it stays testable and reusable by dry-run.
- Prefer exact/pinned dependency versions (the repo pins versions and uses pnpm `minimumReleaseAge`).
