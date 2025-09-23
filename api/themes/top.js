// api/themes/top.js
import { prisma } from '../../lib/db.js';

export const config = { runtime: 'nodejs' };

/**
 * Returns top themes computed directly from Signal.
 * Adds UI-friendly fields: heat, momentum, forecast, confidence, awa, link.
 *
 * Query params:
 *   region   = string (default "All")
 *   days     = lookback window (default 14)
 *   short    = short subwindow used for momentum (default 3)
 *   limit    = max items (default 10)
 */
export default async function handler(req, res) {
  try {
    const region = String(req.query.region || 'All').trim();
    const days = clampInt(req.query.days ?? '14', 1, 60);
    const short = clampInt(req.query.short ?? '3', 1, Math.min(7, days - 1));
    const limit = clampInt(req.query.limit ?? '10', 1, 50);

    const now = Date.now();
    const sinceLong = new Date(now - days * 24 * 60 * 60 * 1000);
    const sinceShort = new Date(now - short * 24 * 60 * 60 * 1000);

    // Pull recent signals for the region
    const signals = await prisma.signal.findMany({
      where: {
        region,
        observedAt: { gte: sinceLong },
      },
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

    // Partition into short and long windows for momentum calc
    const longMap = new Map();   // all rows in [sinceLong, now]
    const shortMap = new Map();  // rows in [sinceShort, now]
    for (const s of signals) {
      const e = s.entity;
      push(longMap, e, s);
      if (s.observedAt >= sinceShort) push(shortMap, e, s);
    }

    // Aggregate by entity
    const rows = [];
    for (const [entity, arrLong] of longMap.entries()) {
      const arrShort = shortMap.get(entity) || [];

      const aggLong = aggregate(arrLong);
      const aggShort = aggregate(arrShort);

      // heat: a 0..1 score suitable for UI — use avg score from long window
      const heat = safeNumber(aggLong.avgScore);

      // momentum: short avg minus long avg (absolute). If you prefer %, switch to (short-long)/max(long,eps).
      const momentumRaw = safeNumber(aggShort.avgScore) - safeNumber(aggLong.avgScore);
      const momentum = round4(momentumRaw);

      // naive 2w forecast: move heat by one momentum step
      const forecast = round4(heat + momentum);

      // confidence: based on sample size in the long window (soft-clamped to 0..1)
      const confidence = round4(softClamp(aggLong.count / 20)); // ~1.0 by 20+ samples

      // awa label for the badge column
      const awa =
        heat >= 0.75 && momentum > 0 ? 'Act' :
        heat >= 0.50 ? 'Watch' :
        'Aware';

      // a simple link users can click (keeps it generic)
      const link = `https://www.youtube.com/results?search_query=${encodeURIComponent(entity)}`;

      rows.push({
        // old fields (keep for compatibility)
        entity,
        avgScore: round4(aggLong.avgScore),
        totalViews: Math.trunc(aggLong.totalViews),
        avgEng: round4(aggLong.avgEng),
        avgAuth: round4(aggLong.avgAuth),

        // new UI-friendly fields
        theme: entity,
        heat,
        momentum,
        forecast,
        confidence,
        awa,
        link,
      });
    }

    // Sort by heat desc, then momentum, then views
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

function clampInt(v, min, max) {
  const n = parseInt(String(v), 10);
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function push(map, key, val) {
  const arr = map.get(key) || [];
  arr.push(val);
  map.set(key, arr);
}

function aggregate(arr) {
  const n = arr.length || 1;
  const sumScore = arr.reduce((s, x) => s + num(x.score), 0);
  const sumViews = arr.reduce((s, x) => s + num(x.views), 0);
  const sumEng = arr.reduce((s, x) => s + num(x.engagement), 0);
  const sumAuth = arr.reduce((s, x) => s + num(x.authority), 0);
  return {
    count: arr.length,
    avgScore: sumScore / n,
    totalViews: sumViews,
    avgEng: sumEng / n,
    avgAuth: sumAuth / n,
  };
}

function num(v) { return Number(v || 0) }
function round4(v) { return Math.round(num(v) * 1e4) / 1e4 }
function safeNumber(v) { const n = num(v); return Number.isFinite(n) ? n : 0 }
function softClamp(v) { return Math.max(0, Math.min(1, num(v))) }
