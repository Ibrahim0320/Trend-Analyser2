// api/themes/top.js
import { prisma } from '../../lib/db.js';

export default async function handler(req, res) {
  try {
    const region = String(req.query.region || 'All');
    const limit  = Math.min(parseInt(req.query.limit || '10', 10), 25);

    const weekRows = await prisma.theme.findMany({
      where: { region },
      orderBy: [{ week_of: 'desc' }, { heat: 'desc' }],
      take: limit
    });

    if (!weekRows.length) {
      return res.status(200).json({ data: [] });
    }

    const data = weekRows.map(r => ({
      theme: r.label,
      heat: r.heat,
      momentum: r.momentum,
      forecast_heat: r.forecast_heat,
      confidence: r.confidence,
      act_watch_avoid: r.act_watch_avoid,
      links: r.links || []
    }));
    return res.status(200).json({ data });
  } catch (e) {
    console.error('[themes/top] error', e);
    return res.status(500).json({ error: 'Internal error' });
  }
}
