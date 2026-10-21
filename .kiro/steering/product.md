# Product

**Giá Vàng Hôm Nay** is a Vietnamese gold-price tracking system. It collects, validates, and publishes gold prices (domestic brands like SJC/DOJI/PNJ, world XAU/XAG, and FX rates) and serves them to end users across multiple clients.

## Clients

- **Mobile app** (Flutter, Android/iOS) — primary consumer-facing app. Phase 0 shipped: 4-tab shell with a working World tab.
- **Public web** (Astro static site) — SEO-focused, deployed to GitHub Pages.
- **Admin dashboard** (React + Vite SPA) — internal catalog, source config, mapping, and price-review tooling, protected by Cloudflare Access.
- **API** (Cloudflare Worker `gold-api`) — shared backend for all clients, plus the crawler engine and price alerts.

## Core principles

- **D1 (SQLite) is the single source of truth.** KV, HTML cache, and on-device caches are only snapshots.
- **Wrong data is more dangerous than slow data.** Abnormal prices go to a moderation queue, never published directly.
- **Configuration is data, not code.** New price sources are added via the admin dashboard, not by deploying code.
- **Every config change is versioned and audited**, and can be rolled back.

## Conventions that affect behavior

- Prices are stored as **integer đồng per lượng** (1 lượng = 10 chỉ = 37.5 g).
- Timestamps are **unix seconds in UTC**; the trading day is computed in **`Asia/Ho_Chi_Minh`**.
- Public read API needs **no token** (anonymous viewing); login unlocks extra features (favorites sync, personal alerts).
- All prices shown in the app are for reference only. The current World tab shows **converted world price, not domestic price**.

## Language

Product docs, UI copy, comments, and commit messages are primarily in **Vietnamese**. Match the existing language of the file or surrounding context.
