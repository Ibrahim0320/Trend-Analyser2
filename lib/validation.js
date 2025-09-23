// /lib/validation.js
import { z } from 'zod';

export const RunResearchSchema = z.object({
  region: z.string().min(1).max(40).default('All'),
  keywords: z
    .array(z.string().min(1).max(48))
    .min(0)
    .max(8)
    .optional(),
});

export const InsightSchema = z.object({
  region: z.string().min(1).max(40),
  entities: z
    .array(
      z.object({
        entity: z.string(),
        agg: z
          .object({
            views: z.number().optional(),
            engagement: z.number().optional(),
            authority: z.number().optional(),
          })
          .partial(),
        top: z.array(
          z.object({
            provider: z.string().optional(),
            engagement: z.number().optional(),
            authority: z.number().optional(),
            newsRank: z.number().optional(),
          }),
        ).optional(),
      }),
    )
    .min(1),
});
