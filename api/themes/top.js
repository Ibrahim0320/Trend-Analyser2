// api/themes/top.js
export const config = { runtime: 'nodejs' };

import { prisma } from '../../lib/db.js';

/**
 * GET /api/themes/top?region=Nordics&limit=10
 */
export default async function handler(req, res) {
  try {
    const region = String(req.query.region || 'All');
    const limit = Math.max(1, Math.min(50, Number(req.query.limit || 10)));

    // If you store themes in a table named Theme (id, org/region, label, heat, momentum, etc.)
    // This returns the latest for the region. Adjust to your schema.
    const rows = await prisma.theme.findMany({
      where: { region },
      orderBy: [{ week_of: 'desc' }, { heat: 'desc' }],
      take: limit,
    });

    const data = rows.map(r => ({
      theme: r.label,
      heat: r.heat,
      momentum: r.momentum,
      forecast_heat: r.forecast_heat ?? null,
      confidence: r.confidence ?? null,
      act_watch_avoid: r.act_watch_avoid ?? null,
      links: r.links ?? [],
    }));

    return res.status(200).json({ ok: true, data });
  } catch (err) {
    console.error('[api/themes/top] error:', err);
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
}
