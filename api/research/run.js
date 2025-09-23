// /api/research/run.js
import { prisma } from '../../lib/db.js';
import { fetchYouTubeSignals } from '../../lib/providers/youtube.js';
import { fetchGdeltSignals } from '../../lib/providers/gdelt.js';
import { fetchTrendsSignals } from '../../lib/providers/trends.js';
import { RunResearchSchema } from '../../lib/validation.js';
import { safe } from '../../lib/http.js';

export const config = { runtime: 'nodejs' };

// Score (stable, simple)
function scoreOne(s) {
  const viewsTerm = Math.log10((s.views ?? 0) + 1);
  const engage = Number(s.engagement ?? 0);
  const auth = Number(s.authority ?? 0);
  const vel = Number(s.velocity ?? 0);
  const news = Number(s.newsRank ?? 0);
  return Number((0.4 * engage + 0.25 * auth + 0.15 * vel + 0.1 * news + 0.1 * viewsTerm).toFixed(4));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const parsed = RunResearchSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    }
    const { region, keywords: inKw } = parsed.data;

    // Load watchlist if no keywords provided
    let keywords = Array.isArray(inKw) && inKw.length ? inKw : [];
    if (!keywords.length) {
      const wl = await prisma.watchlist.findUnique({ where: { region } }).catch(() => null);
      keywords = Array.isArray(wl?.keywords) && wl.keywords.length ? wl.keywords : ['trenchcoat', 'loafers', 'quiet luxury'];
    }
    keywords = keywords.map(s => s.trim()).filter(Boolean).slice(0, 8);

    const collected = [];
    const now = new Date();

    for (const kw of keywords) {
      const [yt, news, tr] = await Promise.all([
        safe(fetchYouTubeSignals({ apiKey: process.env.YOUTUBE_API_KEY, query: kw }, { timeoutMs: 6000, retries: 1 }), []),
        safe(fetchGdeltSignals({ query: kw }, { timeoutMs: 6000, retries: 1 }), []),
        safe(fetchTrendsSignals({ query: kw }, { timeoutMs: 6000, retries: 0 }), []),
      ]);

      const norm = (arr, provider) =>
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

      collected.push(...norm(yt, 'youtube'), ...norm(news, 'gdelt'), ...norm(tr, 'trends'));
    }

    // Filter obvious junk
    const filtered = collected.filter(
      s => (s.views + s.likes + s.comments + s.shares > 0) || s.searchVol > 0 || s.newsRank > 0 || s.engagement > 0 || s.authority > 0,
    );

    const scored = filtered.map((s) => ({ ...s, score: scoreOne(s) }));

    // Best-effort persist
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
        }).catch(() => null),
      ),
      { timeout: 15000 },
    ).catch(() => null);

    // Summarize for UI
    const byEntity = new Map();
    for (const s of scored) {
      const list = byEntity.get(s.entity) || [];
      list.push(s);
      byEntity.set(s.entity, list);
    }

    const entities = Array.from(byEntity.entries()).map(([entity, arr]) => {
      const top = [...arr].sort((a, b) => b.score - a.score).slice(0, 5);
      const agg = {
        views: top.reduce((n, x) => n + (x.views || 0), 0),
        engagement: Number((top.reduce((n, x) => n + (x.engagement || 0), 0) / Math.max(top.length, 1)).toFixed(4)),
        authority: Number((top.reduce((n, x) => n + (x.authority || 0), 0) / Math.max(top.length, 1)).toFixed(4)),
      };
      return { entity, top, agg };
    });

    res.status(200).json({
      ok: true,
      region,
      keywords,
      totalSignals: scored.length,
      entities,
      now: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[research/run] error', err);
    res.status(500).json({ error: 'Internal error' });
  }
}
