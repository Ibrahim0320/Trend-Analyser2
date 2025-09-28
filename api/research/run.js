// /api/research/run.js
import { prisma } from '../../lib/db.js';            // keep your existing prisma import
import { fetchRedditSignals } from '../../lib/providers/reddit.js';
import { PROVIDER_RULES } from '../../lib/providers/config.js';

// --- helpers you already had ---
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

// derive engagement/velocity/authority from a raw signal row
function deriveEVA(s) {
  // You can refine this as you like; keep it consistent across providers
  const eng = clamp01(
    (Number(s.likes ?? 0) * 1.0 + Number(s.comments ?? 0) * 2.0 + Number(s.shares ?? 0) * 1.5) /
    (Number(s.views ?? 0) > 0 ? Math.max(10, Number(s.views)) : 50_000)
  );
  // crude velocity: newer posts get a bump
  const ageMin = (() => {
    const t = s.observedAt ? new Date(s.observedAt).getTime() : Date.now();
    const mins = (Date.now() - t) / 60000;
    return Math.max(1, mins);
  })();
  const vel = clamp01((Number(s.comments ?? 0) + Number(s.likes ?? 0) / 5) / ageMin);

  // authority: per-provider base weight + any rank/score hints
  const w = (PROVIDER_RULES[s.provider]?.weight ?? 1.0);
  const base = s.rank ? clamp01(Number(s.rank) / 100) : 0.5;
  const auth = clamp01(base * w);

  return { eng, vel, auth };
}

function scoreOf({ eng, vel, auth }) {
  // Weighted blend; authority slightly less dominant so new signals can surface
  return clamp01(0.45 * eng + 0.35 * vel + 0.20 * auth);
}

// 🔹 Gather signals from enabled providers (extensible)
async function gatherSignals({ region, keywords, limit = 30, since = 21 }) {
  const stacks = [];

  // Existing providers (YouTube/News/Trends) go here if you have them already
  // e.g., stacks.push(fetchYouTubeSignals(...)), etc.

  // Reddit
  if (process.env.REDDIT_ENABLED === 'true') {
    stacks.push(
      fetchRedditSignals({ keywords, region, limit: Math.min(limit, 12) })
        .catch(() => [])
    );
  }

  const chunks = await Promise.allSettled(stacks);
  const all = [];
  for (const c of chunks) {
    if (c.status === 'fulfilled' && Array.isArray(c.value)) all.push(...c.value);
  }

  // cap to keep UI stable
  return all.slice(0, limit * 3);
}

// --- your rollup with citations kept intact (unchanged except better link picking)
function rollupEntities({ region, signals, topK = 30 }) {
  const byEntity = new Map();

  for (const s of signals) {
    const entity = (s.entity || '').trim();
    if (!entity) continue;

    const { eng, vel, auth } = deriveEVA(s);
    const score = typeof s.score === 'number' ? clamp01(s.score) : scoreOf({ eng, vel, auth });

    const row = {
      provider: s.provider || 'unknown',
      title: s.title || s.entity || '',
      url: s.url || s.link || null,
      observedAt: s.observedAt ? new Date(s.observedAt) : new Date(),
      eng, vel, auth, score,
      views: s.views ?? 0,
      likes: s.likes ?? 0,
      comments: s.comments ?? 0,
      sourceId: s.sourceId ?? null,
    };

    const list = byEntity.get(entity) || [];
    list.push(row);
    byEntity.set(entity, list);
  }

  const rows = [];
  for (const [entity, arr] of byEntity.entries()) {
    // keep topK by score for stability
    const top = [...arr].sort((a, b) => b.score - a.score).slice(0, topK);

    const heat = avg(top.map(x => x.score));
    const momentum = avg(top.map(x => x.vel));
    const confidence = avg(top.map(x => x.auth));
    // proxy forecast: 0.6*momentum + 0.4*heat
    const forecast = clamp01(0.6 * momentum + 0.4 * heat);

    // 🔹 Prefer a real URL; if none, fall back per best provider
    const providerSearch = (prov) => {
      if (prov === 'reddit') return `https://www.reddit.com/search?q=${encodeURIComponent(entity)}`;
      if (prov === 'youtube') return `https://www.youtube.com/results?search_query=${encodeURIComponent(entity)}`;
      return `https://www.google.com/search?q=${encodeURIComponent(entity)}`;
    };
    let link = top.find(x => x.url)?.url
      || providerSearch(top[0]?.provider || '');

    // citations: top 5 distinct providers/urls
    const citations = [];
    const seen = new Set();
    for (const x of top) {
      const key = `${x.provider}|${x.url || x.title}`;
      if (seen.has(key)) continue;
      seen.add(key);
      citations.push({
        provider: x.provider,
        title: x.title || entity,
        url: x.url || null,
        authority: Number(x.auth?.toFixed?.(2) ?? x.auth) || 0,
        when: x.observedAt?.toISOString?.() ?? new Date().toISOString(),
      });
      if (citations.length >= 5) break;
    }

    rows.push({
      entity,
      heat: Number(heat.toFixed(4)),
      momentum: Number(momentum.toFixed(4)),
      forecast: Number(forecast.toFixed(4)),
      confidence: Number(confidence.toFixed(4)),
      awa: confidence >= 0.8 ? 'Aware' : confidence >= 0.6 ? 'Watch' : 'Assess',
      link,
      citations,
    });
  }

  rows.sort((a, b) => b.heat - a.heat);
  return rows;
}

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body || {};
    const region = (body.region || 'All').trim();

    // Keywords from body or Watchlist fallback
    let keywords = Array.isArray(body.keywords)
      ? body.keywords
      : (typeof body.keywords === 'string' ? body.keywords.split(',') : []);

    if (!keywords.length) {
      try {
        const wl = await prisma.watchlist.findUnique({ where: { region } });
        if (Array.isArray(wl?.keywords) && wl.keywords.length) keywords = wl.keywords;
      } catch { /* ignore */ }
    }
    if (!keywords.length) keywords = ['trenchcoat', 'loafers', 'quiet luxury'];
    keywords = keywords.map(s => String(s).trim()).filter(Boolean).slice(0, 10);

    // 1) Gather signals
    const signals = await gatherSignals({ region, keywords, limit: 30, since: 21 });

    // 2) Roll-up
    const entityRows = rollupEntities({ region, signals, topK: 30 });

    // 3) Persist (best-effort)
    try {
      const createOps = signals.slice(0, 500).map((s) =>
        prisma.signal.create({
          data: {
            region,
            entity: s.entity || '',
            entityType: 'theme',
            provider: s.provider || 'unknown',
            sourceId: s.sourceId ?? null,
            views: Number(s.views ?? 0),
            likes: Number(s.likes ?? 0),
            comments: Number(s.comments ?? 0),
            shares: Number(s.shares ?? 0),
            searchVol: Number(s.searchVol ?? s.rank ?? 0),
            newsRank: Number(s.newsRank ?? 0),
            engagement: deriveEVA(s).eng,
            velocity: deriveEVA(s).vel,
            authority: deriveEVA(s).auth,
            score: typeof s.score === 'number' ? s.score : scoreOf(deriveEVA(s)),
            observedAt: s.observedAt ? new Date(s.observedAt) : new Date(),
            url: s.url ?? null,          // if your schema has it
            title: s.title ?? null,      // if your schema has it
            providerWeight: (PROVIDER_RULES[s.provider]?.weight ?? 1.0), // if your schema has it
          },
        })
      );
      if (createOps.length) {
        await prisma.$transaction(createOps, { timeout: 15_000 });
      }
    } catch {
      for (const s of signals.slice(0, 200)) {
        try {
          const eva = deriveEVA(s);
          await prisma.signal.create({
            data: {
              region,
              entity: s.entity || '',
              entityType: 'theme',
              provider: s.provider || 'unknown',
              sourceId: s.sourceId ?? null,
              views: Number(s.views ?? 0),
              likes: Number(s.likes ?? 0),
              comments: Number(s.comments ?? 0),
              shares: Number(s.shares ?? 0),
              searchVol: Number(s.searchVol ?? s.rank ?? 0),
              newsRank: Number(s.newsRank ?? 0),
              engagement: eva.eng,
              velocity: eva.vel,
              authority: eva.auth,
              score: typeof s.score === 'number' ? s.score : scoreOf(eva),
              observedAt: s.observedAt ? new Date(s.observedAt) : new Date(),
              url: s.url ?? null,
              title: s.title ?? null,
              providerWeight: (PROVIDER_RULES[s.provider]?.weight ?? 1.0),
            },
          });
        } catch { /* swallow */ }
      }
    }

    // 4) Response
    const legacyEntities = entityRows.map((r) => ({
      entity: r.entity,
      avgScore: r.heat,
      avgAuth: r.confidence,
      agg: { engagement: r.heat, authority: r.confidence },
      link: r.link,
      citations: r.citations,
    }));

    return res.status(200).json({
      ok: true,
      region,
      keywords,
      totalSignals: signals.length,
      data: entityRows,
      entities: legacyEntities,
    });
  } catch (err) {
    console.error('[research/run] error', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
