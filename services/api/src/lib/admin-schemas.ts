import { z } from 'zod';

const id = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9-]+$/, 'chỉ gồm chữ thường, số, gạch ngang');
const slug = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9-]+$/, 'slug chỉ gồm chữ thường, số, gạch ngang');

export const BrandCreate = z.object({
  id,
  slug,
  name: z.string().min(1).max(100),
  logoR2Key: z.string().max(200).optional(),
  sortOrder: z.number().int().min(0).default(0),
});
export const BrandUpdate = z.object({
  slug: slug.optional(),
  name: z.string().min(1).max(100).optional(),
  logoR2Key: z.string().max(200).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

export const ProductCreate = z.object({
  id,
  brandId: id,
  slug,
  name: z.string().min(1).max(120),
  kind: z.enum(['bar', 'ring', 'jewelry']),
  purity: z.string().max(10).optional(),
  region: z.string().max(10).optional(),
  maxSpreadPct: z.number().positive().max(100).default(10),
  maxChangePct: z.number().positive().max(100).default(5),
  sortOrder: z.number().int().min(0).default(0),
});
export const ProductUpdate = z.object({
  slug: slug.optional(),
  name: z.string().min(1).max(120).optional(),
  kind: z.enum(['bar', 'ring', 'jewelry']).optional(),
  purity: z.string().max(10).nullable().optional(),
  region: z.string().max(10).nullable().optional(),
  maxSpreadPct: z.number().positive().max(100).optional(),
  maxChangePct: z.number().positive().max(100).optional(),
  sortOrder: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

export const SourceCreate = z.object({
  id,
  name: z.string().min(1).max(100),
  kind: z.enum(['domestic', 'world', 'fx']),
  intervalSec: z.number().int().min(60).max(86_400).default(300),
  note: z.string().max(500).optional(),
});
export const SourceUpdate = z.object({
  name: z.string().min(1).max(100).optional(),
  intervalSec: z.number().int().min(60).max(86_400).optional(),
  enabled: z.boolean().optional(),
  termsChecked: z.boolean().optional(),
  note: z.string().max(500).nullable().optional(),
});

export const MappingUpdate = z.object({
  productId: id.nullable(),
  status: z.enum(['mapped', 'ignored', 'pending']),
});

export const ManualPrice = z.object({
  productId: id,
  buy: z.number().int().positive(),
  sell: z.number().int().positive(),
});

export const AdminUpsert = z.object({
  email: z.string().email().max(200),
  role: z.enum(['viewer', 'editor', 'owner']),
});
