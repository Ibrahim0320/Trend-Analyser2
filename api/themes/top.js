// api/themes/top.js
import { prisma } from '../../lib/db.js';

export const config = { runtime: 'nodejs' };

/**
 * Returns top themes by average score over a recent window (default 7 days),
 * computed directly from the Signal table so the UI can populate without a
 * separate rollup job.
 *
 * Query params:
 *   region   = string (default "All")
 *   days     = integer number of days to look back (default 7)
 *   limit    = integer max items (default 10)
 */
export default async function handler(req, res) {
  try {
    const region = String(req.query.region || 'All').trim();
    const days = Math.max(1, Math.min(60, parseInt(req.query.days ?? '7', 10)));
    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit ?? '10', 10)));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Pull recent signals for the region
    const signals = await prisma.signal.findMany({
      where: {
        region,
        observedAt: { gte: since },
      },
      select: {
        entity: true,
        score: true,
        views: true,
        engagement: true,
        authority: true,
      },
    });

    if (!signals.length) {
      return res.status(200).json({ ok: true, data: [] });
    }

    // Aggregate by entity
    const byEntity = new Map();
    for (const s of signals) {
      const arr = byEntity.get(s.entity) || [];
      arr.push(s);
      byEntity.set(s.entity, arr);
    }

    const rows = Array.from(byEntity.entries()).map(([entity, arr]) => {
      const n = arr.length || 1;
      const avgScore = arr.reduce((sum, x) => sum + Number(x.score || 0), 0) / n;
      const totalViews = arr.reduce((sum, x) => sum + Number(x.views || 0), 0);
      const avgEng = arr.reduce((sum, x) => sum + Number(x.engagement || 0), 0) / n;
      const avgAuth = arr.reduce((sum, x) => sum + Number(x.authority || 0), 0) / n;
      return {
        entity,
        avgScore: Number(avgScore.toFixed(4)),
        totalViews,
        avgEng: Number(avgEng.toFixed(4)),
        avgAuth: Number(avgAuth.toFixed(4)),
      };
    });

    // Sort by score desc; tie-break by views
    rows.sort((a, b) => (b.avgScore - a.avgScore) || (b.totalViews - a.totalViews));

    return res.status(200).json({
      ok: true,
      data: rows.slice(0, limit),
      meta: { region, since: since.toISOString(), count: signals.length },
    });
  } catch (e) {
    console.error('[themes/top] error', e);
    return res.status(200).json({ ok: true, data: [] });
  }
}
