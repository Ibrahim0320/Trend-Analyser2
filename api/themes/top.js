// api/themes/top.js
import { prisma } from '../../lib/db.js';

export const config = { runtime: 'nodejs' };

/**
 * Top themes with UI-friendly fields:
 *  - heatPct (0..100), forecastPct (0..100), confidencePct (0..100)
 *  - momentumPct (signed, -100..100), momentumSign ('up'|'down'|'flat')
 *  - url (alias of link)
 *
 * Query:
 *   region = string (default "All")
 *   days   = long window days (default 14)
 *   short  = short window days (default 3)
 *   limit  = max rows (default 10)
 */
export default async function handler(req, res) {
  try {
    const region = String(req.query.region || 'All').trim();
    const days = clampInt(req.query.days ?? '14', 1, 60);
    const short = clampInt(req.query.short ?? '3', 1, Math.min(7, days - 1));
    const limit = clampInt(req.query.limit ?? '10', 1, 50);

    const now = Date.now();
    const sinceLong = new Date(now - days * 86400_000);
    const sinceShort = new Date(now - short * 86400_000);

    const signals = await prisma.signal.findMany({
      where: { region, observedAt: { gte: sinceLong } },
      select: {
        entity: true,
        score: true,
        views: true,
        engagement: true,
        authority: true,
        observedAt: true,
      },
    });

    if (!signals.length) {
      return res.status(200).json({ ok: true, data: [] });
    }

    const longMap = new Map();
    const shortMap = new Map();
    for (const s of signals) {
      push(longMap, s.entity, s);
      if (s.observedAt >= sinceShort) push(shortMap, s.entity, s);
    }

    const rows = [];
    for (const [entity, arrLong] of longMap.entries()) {
      const arrShort = shortMap.get(entity) || [];

      const aggL = aggregate(arrLong);
      const aggS = aggregate(arrShort);

      // core values in 0..1
      const heat = safeNumber(aggL.avgScore);
      const momentum = clampUnit( safeNumber(aggS.avgScore) - safeNumber(aggL.avgScore) );
      const forecast = clampUnit(heat + momentum);
      const confidence = softClamp(aggL.count / 20); // ~1.0 once 20+ samples

      // display/compat fields
      const heatPct = toPct(heat);
      const forecastPct = toPct(forecast);
      const confidencePct = toPct(confidence);
      const momentumPct = Math.round(momentum * 100);         // signed
      const momentumSign = momentum > 0 ? 'up' : momentum < 0 ? 'down' : 'flat';

      const link = `https://www.youtube.com/results?search_query=${encodeURIComponent(entity)}`;
      const awa =
        heat >= 0.75 && momentum > 0 ? 'Act' :
        heat >= 0.50 ? 'Watch' : 'Aware';

      rows.push({
        // old analytic fields (keep)
        entity,
        avgScore: round4(aggL.avgScore),
        totalViews: Math.trunc(aggL.totalViews),
        avgEng: round4(aggL.avgEng),
        avgAuth: round4(aggL.avgAuth),

        // normalized core fields
        theme: entity,
        heat: round4(heat),
        momentum: round4(momentum),
        forecast: round4(forecast),
        confidence: round4(confidence),

        // UI-friendly fields the table likely expects
        heatPct,
        forecastPct,
        confidencePct,
        momentumPct,
        momentumSign,
        awa,
        link,
        url: link, // alias for clients that read `url`
      });
    }

    rows.sort((a, b) =>
      (b.heat - a.heat) ||
      (b.momentum - a.momentum) ||
      (b.totalViews - a.totalViews)
    );

    return res.status(200).json({
      ok: true,
      data: rows.slice(0, limit),
      meta: {
        region,
        since: sinceLong.toISOString(),
        shortWindowDays: short,
        longWindowDays: days,
        totalSignals: signals.length,
      },
    });
  } catch (e) {
    console.error('[themes/top] error', e);
    return res.status(200).json({ ok: true, data: [] });
  }
}

/* ---------- helpers ---------- */
function clampInt(v, min, max) { const n = parseInt(String(v), 10); return Number.isNaN(n) ? min : Math.max(min, Math.min(max, n)); }
function push(map, key, val) { const arr = map.get(key) || []; arr.push(val); map.set(key, arr); }
function num(v) { return Number(v || 0); }
function round4(v) { return Math.round(num(v) * 1e4) / 1e4; }
function
