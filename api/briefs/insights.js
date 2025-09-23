// /api/briefs/insights.js
import { prisma } from '../../lib/db.js';
import { generateBullets } from '../../lib/ai.js';
import z from 'zod';

export const config = { runtime: 'nodejs' };

// --- input validation (local to this file to avoid changing lib/validation.js) ---
const BriefInputSchema = z.object({
  region: z.string().min(1).max(40).default('All'),
  // Accept either array of strings, or array of { entity: string }
  entities: z
    .array(z.union([z.string().min(1), z.object({ entity: z.string().min(1) })]))
    .min(1, 'At least one entity is required'),
  lookbackDays: z.number().int().min(1).max(90).default(14),
  limit: z.number().int().min(1).max(20).default(5),
});

// --- tiny helpers ---
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const avg = (arr) => (arr.length ? arr.reduce((n, v) => n + (v ?? 0), 0) / arr.length : 0);

// blend engagement + authority into a single "heat" feel (bounded 0..1)
function computeHeat({ engagement = 0, authority = 0 }) {
  return clamp01(0.7 * engagement + 0.3 * authority);
}

// naive 2w forecast from current heat
function forecast2w(heat) {
  // very light optimism with cap
  return clamp01(heat * 0.9 + 0.08);
}

// leaders rank metric
function leaderScore(auth, eng) {
  return 0.55 * (auth ?? 0) + 0.45 * (eng ?? 0);
}

// compute “momentum” (recent vs earlier in-window)
function computeMomentum(points, nowTs) {
  if (!points.length) return 0;
  const sorted = [...points].sort((a, b) => new Date(a.observedAt) - new Date(b.observedAt));
  const mid = Math.floor(sorted.length / 2) || 1;
  const early = sorted.slice(0, mid);
  const late = sorted.slice(mid);

  const earlyHeat = computeHeat({
    engagement: avg(early.map((p) => p.engagement ?? 0)),
    authority: avg(early.map((p) => p.authority ?? 0)),
  });
  const lateHeat = computeHeat({
    engagement: avg(late.map((p) => p.engagement ?? 0)),
    authority: avg(late.map((p) => p.authority ?? 0)),
  });

  // small difference, bounded
  return clamp01(lateHeat - earlyHeat + 0.5) - 0.5; // ~ -0.5..+0.5
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const parsed = BriefInputSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    }
    const { region, entities: rawEntities, lookbackDays, limit } = parsed.data;

    // normalize entities to string[]
    const entities = rawEntities.map((e) => (typeof e === 'string' ? e : e.entity)).slice(0, 12);

    const now = new Date();
    const since = new Date(now.getTime() - lookbackDays * 86400e3);

    // Pull recent signals for region+entities
    const signals = await prisma.signal.findMany({
      where: {
        region,
        entity: { in: entities },
        observedAt: { gte: since },
      },
      orderBy: { observedAt: 'desc' },
      take: 5000, // cap for safety
    });

    // Group by entity
    const byEntity = new Map();
    for (const s of signals) {
      if (!byEntity.has(s.entity)) byEntity.set(s.entity, []);
      byEntity.get(s.entity).push(s);
    }

    // --- THEMES (Top Movers) ---
    const themes = entities.map((entity) => {
      const pts = byEntity.get(entity) ?? [];
      const engagement = avg(pts.map((p) => p.engagement ?? 0));
      const authority = avg(pts.map((p) => p.authority ?? 0));
      const heat = computeHeat({ engagement, authority });
      const momentum = computeMomentum(pts, now.getTime()); // roughly -0.5..+0.5
      const forecast = forecast2w(heat);
      const confidence = clamp01(authority); // treat authority as confidence proxy

      const link =
        `https://www.youtube.com/results?search_query=${encodeURIComponent(entity)}`;

      return {
        entity,
        heat: Number(heat.toFixed(3)),
        momentum: Number(momentum.toFixed(3)),
        forecast2w: Number(forecast.toFixed(3)),
        confidence: Number(confidence.toFixed(3)),
        link,
        agg: {
          views: Math.round(pts.reduce((n, p) => n + (p.views || 0), 0)),
          engagement: Number(engagement.toFixed(4)),
          authority: Number(authority.toFixed(4)),
          count: pts.length,
        },
      };
    })
    .sort((a, b) => b.heat - a.heat)
    .slice(0, limit);

    // --- LEADERS (provider x entity) ---
    const leaderRows = [];
    for (const [entity, pts] of byEntity.entries()) {
      const byProvider = new Map();
      for (const p of pts) {
        const key = p.provider || 'unknown';
        if (!byProvider.has(key)) byProvider.set(key, []);
        byProvider.get(key).push(p);
      }
      for (const [provider, arr] of byProvider.entries()) {
        const avgAuth = avg(arr.map((x) => x.authority ?? 0));
        const avgEng = avg(arr.map((x) => x.engagement ?? 0));
        leaderRows.push({
          entity,
          provider,
          avgAuthority: Number(avgAuth.toFixed(4)),
          avgEng: Number(avgEng.toFixed(4)),
          score: Number(leaderScore(avgAuth, avgEng).toFixed(4)),
        });
      }
    }
    const leaders = leaderRows
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(limit, 10));

    // --- CITATIONS (very light: pick recent GDELT/top items if present) ---
    const citations = signals
      .filter((s) => s.provider === 'gdelt')
      .slice(0, 20)
      .map((s) => ({
        title: s.entity,         // if you later store titles, swap here
        url:
          s.sourceId
            ? `https://search.gdeltproject.org/?query=${encodeURIComponent(s.entity)}`
            : `https://search.gdeltproject.org/?query=${encodeURIComponent(s.entity)}`,
        provider: 'gdelt',
        observedAt: s.observedAt,
      }));

    // --- AI bullets (why this matters) ---
    // Build a compact AI payload from computed theme aggregates
    const entitiesForAI = themes.map((t) => ({
      entity: t.entity,
      agg: {
        engagement: t.agg.engagement,
        authority: t.agg.authority,
        views: t.agg.views,
      },
      top: [], // can be populated later with exemplars if you want
    }));
    const { bullets, provider } = await generateBullets({
      region,
      entities: entitiesForAI,
    });

    return res.status(200).json({
      ok: true,
      meta: {
        generatedAt: now.toISOString(),
        region,
        lookbackDays,
        requested: entities,
      },
      themes,            // Top Movers-like section, sorted by heat
      leaders,           // Provider leaders
      whyThisMatters: { bullets, provider },
      citations,
    });
  } catch (err) {
    console.error('[briefs/insights] error', err);
    // Fail-soft with a minimal but structured payload so the PDF/UI still render
    const now = new Date();
    return res.status(200).json({
      ok: true,
      meta: { generatedAt: now.toISOString() },
      themes: [],
      leaders: [],
      whyThisMatters: {
        bullets: [
          'Data for this brief was limited; broaden the theme list and re-run.',
          'Include both product and brand keywords to improve signal quality.',
          'Prefer recent sources and region-specific terms for sharper insights.',
        ],
        provider: 'fallback',
      },
      citations: [],
    });
  }
}
