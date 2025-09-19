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
  const viewsTerm = Math.log10((s.views ?? 0) + 1);      // 0..~6 for viral vids, stabilizes small numbers
  const engage    = Number(s.engagement ?? 0);           // 0..1-ish (your providers compute this)
  const auth      = Number(s.authority ?? 0);            // 0..1
  const vel       = Number(s.velocity ?? 0);             // 0..1
  const newsRank  = Number(s.newsRank ?? 0);             // 0..1

  // weights chosen to be robust if some fields are missing
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
        : ['trenchcoat', 'loafers', 'quiet luxury']; // safe default
    }

    // Practical cap so one request can’t explode compute time
    keywords = keywords.map(s => String(s).trim()).filter(Boolean).slice(0, 8);

    // Collect signals per keyword from all providers (fail-soft)
    const collected = [];
    for (const kw of keywords) {
      const [yt, news, tr] = await Promise.all([
        safe(fetchYouTubeSignals({ apiKey: process.env.YOUTUBE_API_KEY, query: kw })),
        safe(fetchGdeltSignals({ query: kw })),
        safe(fetchTrendsSignals({ query: kw })),
      ]);

      // Normalize minimal shape expected downstream
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

    // Score and persist (defensively)
    const scored = collected.map((s) => ({ ...s, score: scoreOne(s) }));

    // Persist each row, but never let a single bad row abort the request
    // Use a transaction of best-effort creates (no unique constraint assumed on Signal)
    await prisma.$transaction(
      scored.map((s) =>
        prisma.signal.create({
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
        }).catch(() => null) // swallow row write errors inside the transaction item
      ),
      { timeout: 15000 } // be polite to the serverless runtime
    ).catch(() => null); // swallow transaction-level errors so the API still responds

    // Return a compact, UI-friendly payload
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
