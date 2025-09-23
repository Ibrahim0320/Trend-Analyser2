// api/research/run.js
import { prisma } from '../../lib/db.js';
import { fetchYouTubeSignals } from '../../lib/providers/youtube.js';
import { fetchGdeltSignals } from '../../lib/providers/gdelt.js';
import { fetchTrendsSignals } from '../../lib/providers/trends.js';

import { callProvider } from '../../lib/guard.js';
import { normalizeProviderArray, NormalizedSignal } from '../../lib/schemas.js';
import { scoreOne, summarizeEntity } from '../../lib/scorer.js';

export const config = { runtime: 'nodejs' };

function cleanKeywords(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input.map(String);
  if (typeof input === 'string') return input.split(',').map(s => s.trim());
  return [];
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const started = Date.now();
  const body = req.body || {};
  const region = (body.region || 'All').trim();

  try {
    // 1) Resolve working keywords (prefer request; else server watchlist; else defaults)
    let keywords = cleanKeywords(body.keywords);
    if (!keywords.length) {
      try {
        const wl = await prisma.watchlist.findUnique({ where: { region } });
        if (Array.isArray(wl?.keywords) && wl.keywords.length) {
          keywords = wl.keywords;
        }
      } catch { /* swallow */ }
    }
    if (!keywords.length) keywords = ['trenchcoat', 'loafers', 'quiet luxury'];
    keywords = keywords.map(s => String(s).trim()).filter(Boolean).slice(0, 8);

    // 2) Pull from all providers with guard (timeout/retry/breaker). Never throws.
    const collected = [];
    for (const kw of keywords) {
      const results = await Promise.all([
        callProvider('youtube', () => fetchYouTubeSignals({ apiKey: process.env.YOUTUBE_API_KEY, query: kw })),
        callProvider('gdelt',   () => fetchGdeltSignals({ query: kw })),
        callProvider('trends',  () => fetchTrendsSignals({ query: kw })),
      ]);

      // 3) Validate/normalize each provider’s payload (drop bad rows quietly)
      const yt   = results[0].ok ? normalizeProviderArray(results[0].data, 'youtube') : [];
      const news = results[1].ok ? normalizeProviderArray(results[1].data, 'gdelt')   : [];
      const tr   = results[2].ok ? normalizeProviderArray(results[2].data, 'trends')  : [];

      const all = [...yt, ...news, ...tr].map(s => ({
        region,
        entity: kw,
        entityType: 'theme',
        ...s,
      }));

      // score + final schema validation (keeps the DB clean)
      for (const row of all) {
        row.score = scoreOne(row);
        const parsed = NormalizedSignal.safeParse(row);
        if (parsed.success) collected.push(parsed.data);
      }
    }

    // 4) Best-effort persist (never allow a single row to crash the whole request)
    try {
      await prisma.$transaction(
        collected.map(s =>
          prisma.signal.create({ data: s }).catch(() => null)
        ),
        { timeout: 15_000 }
      ).catch(() => null);
    } catch { /* swallow */ }

    // 5) Summarize for UI
    const byEntity = new Map();
    for (const s of collected) {
      const list = byEntity.get(s.entity) || [];
      list.push(s);
      byEntity.set(s.entity, list);
    }

    const entities = Array.from(byEntity.entries()).map(([entity, arr]) => {
      const top = [...arr].sort((a, b) => b.score - a.score).slice(0, 5);
      const agg = summarizeEntity(top);
      const views = top.reduce((n, x) => n + (x.views || 0), 0);
      return {
        entity,
        top,
        agg: { ...agg, totalViews: views }
      };
    });

    // Sort by heat (your UI reads this naturally)
    entities.sort((a, b) => (b.agg.heat || 0) - (a.agg.heat || 0));

    const tookMs = Date.now() - started;
    return res.status(200).json({
      ok: true,
      region,
      keywords,
      totalSignals: collected.length,
      entities,
      meta: { tookMs }
    });
  } catch (err) {
    // Final safety net. We should rarely land here because guards swallow provider errors.
    console.error('[research/run] fatal', err);
    return res.status(200).json({
      ok: false,
      region,
      keywords: [],
      totalSignals: 0,
      entities: [],
      meta: { error: 'fatal', detail: String(err?.message || err) }
    });
  }
}
