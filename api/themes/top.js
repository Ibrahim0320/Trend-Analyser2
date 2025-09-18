export const config = { runtime: 'nodejs' };

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export default async function handler(req, res) {
  const region = String(req.query.region || 'All');
  const limit = Math.min(parseInt(req.query.limit || '10', 10), 20);

  // If you don’t have a themes table yet, derive from latest leaders snapshot.
  const latest = await prisma.researchRun.findFirst({
    where: { region },
    orderBy: { created_at: 'desc' }
  });

  if (!latest) return res.json({ data: [] });

  const leaders = latest.leaders_json || [];
  const themes = leaders.slice(0, limit).map(l => ({
    theme: l.entity,
    heat: Math.max(30, Math.min(100, Math.round(l.score))), // normalize for UI
    momentum: l.trend >= 0.5 ? 1 : -1,                      // placeholder
    forecast_heat: Math.round(l.score * 1.1),               // naive +10%
    confidence: 0.55,
    act_watch_avoid: (l.score >= 60 ? 'ACT' : l.score >= 45 ? 'WATCH' : 'AVOID'),
    links: l.urls || []
  }));

  res.json({ data: themes });
}
