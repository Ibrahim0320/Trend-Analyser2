// lib/schemas.js
// Zod schemas for provider items and normalized Signal rows.

import { z } from 'zod';

// Minimal provider item (any provider can pass a subset; we default missing fields)
export const ProviderItem = z.object({
  provider: z.string().optional(),
  sourceId: z.string().nullable().optional(),
  views: z.number().nonnegative().optional(),
  likes: z.number().nonnegative().optional(),
  comments: z.number().nonnegative().optional(),
  shares: z.number().nonnegative().optional(),
  searchVol: z.number().nonnegative().optional(),
  newsRank: z.number().min(0).max(1).optional(),
  engagement: z.number().min(0).max(1).optional(),
  velocity: z.number().min(0).max(1).optional(),
  authority: z.number().min(0).max(1).optional(),
  observedAt: z.union([z.string(), z.date()]).optional(),
});

export const ProviderArray = z.array(ProviderItem).default([]);

export function normalizeProviderArray(arr, fallbackProvider) {
  const parsed = ProviderArray.safeParse(arr);
  if (!parsed.success) return [];
  const now = new Date();
  return parsed.data.map(s => ({
    provider: s.provider || fallbackProvider,
    sourceId: s.sourceId ?? null,
    views: s.views ?? 0,
    likes: s.likes ?? 0,
    comments: s.comments ?? 0,
    shares: s.shares ?? 0,
    searchVol: s.searchVol ?? 0,
    newsRank: s.newsRank ?? 0,
    engagement: s.engagement ?? 0,
    velocity: s.velocity ?? 0,
    authority: s.authority ?? 0,
    observedAt: s.observedAt ? new Date(s.observedAt) : now,
  }));
}

// Normalized Signal to persist
export const NormalizedSignal = z.object({
  region: z.string(),
  entity: z.string(),
  entityType: z.enum(['theme', 'brand']).default('theme'),
  provider: z.string(),
  sourceId: z.string().nullable(),
  views: z.number().nonnegative(),
  likes: z.number().nonnegative(),
  comments: z.number().nonnegative(),
  shares: z.number().nonnegative(),
  searchVol: z.number().nonnegative(),
  newsRank: z.number().min(0).max(1),
  engagement: z.number().min(0).max(1),
  velocity: z.number().min(0).max(1),
  authority: z.number().min(0).max(1),
  observedAt: z.date(),
  score: z.number().min(0).max(1),
});
