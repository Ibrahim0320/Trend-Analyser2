// api/themes/top.js
export const config = { runtime: 'nodejs' };

import { prisma } from '../../lib/db.js';

export default async function handler(req, res) {
  try {
    const region = String(req.query.region || 'All');
    const limit = Math.min(20, Number(req.query.limit || 10));

    // grab the latest dayKey we have for this region
    const latest = await prisma.theme.findFirst({
      where: { region },
      orderBy: { dayKey: 'desc' },
      select: { dayKey: true }
    });

    if (!latest) return res.status(200).json({ data: [] });

    const rows = await prisma.theme.findMany({
      where: { region, dayKey: latest.dayKey },
      orderBy: [{ heat: 'desc' }, { updatedAt: 'desc' }],
      take: limit
    });

    // shape to UI
    const data = rows.map(r => ({
      theme: r.theme,
      heat: r.heat,
      momentum: r.momentum,
      forecast_heat: r.forecast_heat,
      confidence: r.confidence,
      act_watch_avoid: r.act_watch_avoid,
      links: r.links || []
    }));

    return res.status(200).json({ data });
  } catch (err) {
    console.error('themes/top error', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
