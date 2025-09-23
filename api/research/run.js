// api/research/run.js
import { prisma } from '../../lib/db.js';

// Prefer the new unified provider blender if available.
// If not, we soft-fallback to your existing 3 providers.
async function gatherSignals({ region, keywords, limit = 30, since = 21 }) {
  // Try the new multi-provider entrypoint.
  try {
    const mod = await import('../../lib/providers/index.js');
    if (mod?.gatherAllProviders) {
      const signals = await mod.gatherAllProviders({ region, keywords, limit, since });
      if (Array.isArray(signals)) return signals;
    }
  } catch {
    // ignore – we’ll fallback below
  }

  // Fallback: call your existing providers (per keyword), fail-soft.
  const out = [];
  const safe = async (p) => {
    try { return await p; } catch { return []; }
  };

  let ytFn, gdeltFn, trendsFn;
  try { ({ fetchYouTubeSignals: ytFn } = await import('../../lib/providers/youtube.js')); } catch {}
  try { ({ fetchGdeltSignals: gdeltFn } = await import('../../lib/providers/gdelt.js')); } catch {}
  try { ({ fetchTrendsSignals: trendsFn } = await import('../../lib/providers/trends.js')); } catch {}

  const nowIso = new Date().toISOString();
  for (const kw of keywords) {
    if (ytFn)    out.push(...(await safe(ytFn({ query: kw, region }))).map(s => ({ ...s, provider: s.provider || 'youtube', entity: kw, observedAt: s.observedAt || nowIso })));
    if (gdeltFn) out.push(...(await safe(gdeltFn({ query: kw, region }))).map(s => ({ ...s, provider: s.provider || 'gdelt',   entity: kw, observedAt: s.observedAt || nowIso })));
    if (trendsFn)out.push(...(await safe(trendsFn({ query: kw, region }))).map(s => ({ ...s, provider: s.provider || 'trends',  entity: kw, observedAt: s.observedAt || nowIso })));
  }
  return out;
}

// Tiny helpers
const clamp01 = (x) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
const avg = (arr) => (arr.length ? arr.reduce((n, x) => n + (Number(x) || 0), 0) / arr.length : 0);
const zLog = (n, denom = 7) => (n > 0 ? Math.min(1, Math.log10(n) / denom) : 0);

// Derive engagement/velocity/authority if adapters didn’t already.
function deriveEVA(sig) {
  // If adapters (new stack) already provided normalized metrics, use them.
  if (typeof sig.engagement === 'number' || typeof sig.velocity === 'number' || typeof sig.authority === 'number') {
    return {
      eng: clamp01(sig.engagement ?? 0),
      vel: clamp01(sig.velocity ?? 0),
      auth: clamp01(sig.authority ?? 0),
    };
  }

  // Otherwise derive something sensible from common fields (legacy providers).
  const views = Number(sig.views ?? 0);
  const likes = Number(sig.likes ?? 0);
  const likeRate = views > 0 ? likes / views : 0;

  if ((sig.provider || '').toLowerCase().includes('youtube')) {
    return {
      eng: clamp01(zLog(views) * 0.6 + likeRate * 0.4),
      vel: 0,                 // legacy providers didn’t expose growth – keep 0
      auth: clamp01((sig.channelSubs ?? 0) / 2_000_000) || 0.6, // fallback mid if unknown
    };
  }
  if ((sig.provider || '').toLowerCase().includes('trends')) {
    return { eng: clamp01(sig.searchVol ?? sig.rank ?? 0), vel: clamp01(sig.rankDelta7d ?? 0), auth: 0.6 };
  }
  if ((sig.provider || '').toLowerCase().includes('gdelt') || (sig.provider || '').toLowerCase().includes('news')) {
    const domainRank = Number(sig.domainRank ?? 70);
    const domainWeight = Number(sig.domainWeight ?? (sig.newsRank ?? 0.7));
    return { eng: clamp01(domainRank / 100), vel: 0.5, auth: clamp01(domainWeight * (domainRank / 100)) };
  }
  // Generic fallback
  return { eng: clamp01(zLog(views)), vel: 0, auth: 0.6 };
}

// Unified score
function scoreOf({ eng, vel, auth }) {
  return clamp01(0.45 * eng + 0.30 * vel + 0.25 * auth);
}

// Roll up signals -> per-entity rows + citations
// Prefer a provider-specific search URL when we have no concrete source URL
function providerSearchUrl(entity, preferredProvider) {
  const q = encodeURIComponent(entity);
  switch ((preferredProvider || '').toLowerCase()) {
    case 'youtube':
      return `https://www.youtube.com/results?search_query=${q}`;
    case 'tiktok':
      return `https://www.tiktok.com/search?q=${q}`;
    case 'instagram':
      return `https://www.instagram.com/explore/tags/${q.replace(/%20/g, '')}/`;
    case 'reddit':
      return `https://www.reddit.com/search/?q=${q}`;
    case 'gdelt':
    case 'news':
      return `https://news.google.com/search?q=${q}`;
    case 'trends':
      return `https://trends.google.com/trends/explore?q=${q}`;
    default:
      return `https://www.youtube.com/results?search_query=${q}`;
  }
}

function isHttpUrl(v) {
  return typeof v === 'string' && /^https?:\/\//i.test(v);
}

function rollupEntities({ region, signals, topK = 30 }) {
  const byEntity = new Map();

  for (const s of signals) {
    const entity = String(s.entity || '').trim();
    if (!entity) continue;

    const { eng, vel, auth } = deriveEVA(s);
    const score = typeof s.score === 'number' ? clamp01(s.score) : scoreOf({ eng, vel, auth });

    const row = {
      provider: s.provider || 'unknown',
      title: s.title || s.entity || '',
      url: isHttpUrl(s.url) ? s.url : (isHttpUrl(s.link) ? s.link : null),
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
    // simple proxy forecast: 0.6*momentum + 0.4*heat (clip to 0..1)
    const forecast = clamp01(0.6 * momentum + 0.4 * heat);

    // citations: top 5 distinct by provider + (url OR title), case-insensitive
    const citations = [];
    const seen = new Set();
    for (const x of top) {
      const key = `${(x.provider || '').toLowerCase()}|${String(x.url || x.title || '').toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      citations.push({
        provider: x.provider,
        title: x.title || entity,
        url: isHttpUrl(x.url) ? x.url : null,
        authority: Number(x.auth?.toFixed?.(2) ?? x.auth) || 0,
        when: x.observedAt?.toISOString?.() ?? new Date().toISOString(),
      });
      if (citations.length >= 5) break;
    }

    // best link = first cited real URL; if none, fallback to provider-specific search
    const preferredProvider = top[0]?.provider || 'youtube';
    const link =
      (citations.find(c => isHttpUrl(c.url))?.url) ||
      providerSearchUrl(entity, preferredProvider);

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

  // Sort entities by heat desc for your main table.
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

    // 1) Gather signals from all available providers (new stack or legacy fallback)
    const signals = await gatherSignals({ region, keywords, limit: 30, since: 21 });

    // 2) Roll up to entity-level rows (heat/momentum/forecast/confidence + citations)
    const entityRows = rollupEntities({ region, signals, topK: 30 });

    // 3) Persist (best-effort). First try a batched transaction of *raw* signals.
    //    IMPORTANT: pass *Prisma Client promises only* (no per-item .catch()).
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
          },
        })
      );
      if (createOps.length) {
        await prisma.$transaction(createOps, { timeout: 15_000 });
      }
    } catch (e) {
      // Fallback: sequential best-effort writes (don’t fail the request)
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
            },
          });
        } catch { /* swallow */ }
      }
    }

    // 4) Response – include both new `data` rows and legacy `entities` summary for compatibility
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
      data: entityRows,       // preferred by your updated UI
      entities: legacyEntities, // for older mappings still in the code
    });
  } catch (err) {
    console.error('[research/run] error', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
