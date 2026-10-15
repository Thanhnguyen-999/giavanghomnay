export type AdminRole = 'viewer' | 'editor' | 'owner';

export interface Me {
  email: string;
  role: AdminRole;
}

export interface Brand {
  id: string;
  slug: string;
  name: string;
  logo_r2_key: string | null;
  sort_order: number;
  active: number;
}

export interface Product {
  id: string;
  brand_id: string;
  slug: string;
  name: string;
  kind: 'bar' | 'ring' | 'jewelry';
  purity: string | null;
  region: string | null;
  max_spread_pct: number;
  max_change_pct: number;
  sort_order: number;
  active: number;
}

export interface Source {
  id: string;
  name: string;
  kind: 'domestic' | 'world' | 'fx';
  enabled: number;
  interval_sec: number;
  active_config_version: number | null;
  next_run_at: number;
  terms_checked: number;
  note: string | null;
}

export interface SourceConfigRow {
  version: number;
  config: string;
  note: string | null;
  created_by: string;
  created_at: number;
}

export interface PreviewRow {
  rawKey: string;
  label: string;
  region?: string;
  buy?: number;
  sell?: number;
  price?: number;
}

export interface PreviewResult {
  rows: PreviewRow[];
  warnings: string[];
  status: number;
  mappedCount: number;
}

export interface Mapping {
  source_id: string;
  raw_key: string;
  product_id: string | null;
  status: 'pending' | 'mapped' | 'ignored';
  sample_buy: number | null;
  sample_sell: number | null;
  last_seen_at: number;
}

export interface Review {
  id: number;
  product_id: string;
  product_name: string;
  source_id: string;
  buy: number;
  sell: number;
  prev_buy: number | null;
  prev_sell: number | null;
  reason: string;
  status: string;
  created_at: number;
}

export interface CrawlRun {
  id: number;
  source_id: string;
  config_version: number;
  started_at: number;
  duration_ms: number | null;
  status: string;
  rows_parsed: number;
  rows_changed: number;
  error: string | null;
}
