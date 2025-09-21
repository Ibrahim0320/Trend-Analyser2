// api/research/run.js
import { prisma } from '../../lib/db.js';
import { fetchYouTubeSignals } from '../../lib/providers/youtube.js';
import { fetchGdeltSignals } from '../../lib/providers/gdelt.js';
import { fetchTrendsSignals } from '../../lib/providers/trends.js';

// Ensure Node runtime on Vercel
export const config = { runtime: 'nodejs' };

// --- tiny helper: safe wrapper so one bad provider doesn't 500 the route ---
const safe = async (promise, fallback = []) => {
  try {
    const v = await promise;
    return Array.isArray(v) ? v : fallback;
  } catch {
    return fallback;
  }
};

// --- tiny helper: simple, transparent scoring (kept local to avoid deps mismatch) ---
function scoreOne(s) {
  const viewsTerm = Math.log10((s.views ?? 0) + 1);
  const engage    = Number(s.engagement ?? 0);
  const auth      = Number(s.authority ?? 0);
  const vel       = Number(s.velocity ?? 0);
  const newsRank  = Number(s.newsRank ?? 0);

  const score =
    0.40 * engage +
    0.25 * auth +
    0.15 * vel +
    0.10 * newsRank +
    0.10 * viewsTerm;

  return Number(score.toFixed(4));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body || {};
    const region = (body.region || 'All').trim();

    // If caller passes keywords, prefer them; otherwise pull from Watchlist for region
    let keywords = Array.isArray(body.keywords)
      ? body.keywords
      : (typeof body.keywords === 'string' ? body.keywords.split(',') : []);

    if (!keywords.length) {
      const wl = await prisma.watchlist.findUnique({ where: { region } }).catch(() => null);
      keywords = Array.isArray(wl?.keywords) && wl.keywords.length
        ? wl.keywords
        : ['trenchcoat', 'loafers', 'quiet luxury'];
    }

    keywords = keywords.map(s => String(s).trim()).filter(Boolean).slice(0, 8);

    // Accept multiple env names for YouTube key
    const YT_KEY =
      process.env.YOUTUBE_API_KEY ||
      process.env.NEXT_PUBLIC_YOUTUBE_API_KEY ||
      process.env.YT_API_KEY ||
      process.env.YOUTUBE_KEY ||
      '';

    // Collect signals per keyword from all providers (fail-soft)
    const collected = [];
    for (const kw of keywords) {
      const [yt, news, tr] = await Promise.all([
        safe(fetchYouTubeSignals({ apiKey: YT_KEY, query: kw })), // ← uses alias key
        safe(fetchGdeltSignals({ query: kw })),
        safe(fetchTrendsSignals({ query: kw })),
      ]);

      const now = new Date();
      const mark = (arr, provider) =>
        (arr || []).map((s) => ({
          region,
          entity: kw,
          entityType: 'theme',
          provider: s.provider || provider,
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

      collected.push(...mark(yt, 'youtube'), ...mark(news, 'gdelt'), ...mark(tr, 'trends'));
    }

    const scored = collected.map((s) => ({ ...s, score: scoreOne(s) }));

    // Best-effort persistence: skip bad rows, never crash the route
    for (const s of scored) {
      try {
        await prisma.signal.create({
          data: {
            region: s.region,
            entity: s.entity,
            entityType: s.entityType,
            provider: s.provider,
            sourceId: s.sourceId,
            views: s.views,
            likes: s.likes,
            comments: s.comments,
            shares: s.shares,
            searchVol: s.searchVol,
            newsRank: s.newsRank,
            engagement: s.engagement,
            velocity: s.velocity,
            authority: s.authority,
            score: s.score,
            observedAt: s.observedAt,
          },
        });
      } catch {
        // swallow and continue
      }
    }

    // Build a compact summary payload for the UI
    const byEntity = new Map();
    for (const s of scored) {
      const list = byEntity.get(s.entity) || [];
      list.push(s);
      byEntity.set(s.entity, list);
    }

    const summary = Array.from(byEntity.entries()).map(([entity, arr]) => {
      const top = [...arr].sort((a, b) => b.score - a.score).slice(0, 5);
      const agg = {
        views: top.reduce((n, x) => n + (x.views || 0), 0),
        engagement: Number(
          (top.reduce((n, x) => n + (x.engagement || 0), 0) / Math.max(top.length, 1)).toFixed(4)
        ),
        authority: Number(
          (top.reduce((n, x) => n + (x.authority || 0), 0) / Math.max(top.length, 1)).toFixed(4)
        ),
      };
      return { entity, top, agg };
    });

    return res.status(200).json({
      ok: true,
      region,
      keywords,
      totalSignals: scored.length,
      entities: summary,
    });
  } catch (err) {
    console.error('[research/run] error', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
