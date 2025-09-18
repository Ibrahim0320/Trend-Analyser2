// api/themes/top.js
import { prisma } from '../../lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const region = String(req.query.region || 'All');
    const limit = Math.min(parseInt(req.query.limit || '10', 10), 50);

    // If you’ve seeded Theme weekly snapshots, return them; otherwise return [].
    const rows = await prisma.theme.findMany({
      where: { region },
      orderBy: [{ heat: 'desc' }, { week_of: 'desc' }],
      take: limit
    });

    const data = rows.map(r => ({
      theme: r.label,
      heat: r.heat,
      momentum: r.momentum,
      forecast_heat: r.forecast_heat ?? null,
      confidence: r.confidence ?? null,
      act_watch_avoid: r.act_watch_avoid ?? null,
      links: r.links ?? []
    }));

    return res.status(200).json({ data });
  } catch (err) {
    console.error('[themes/top] error', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
