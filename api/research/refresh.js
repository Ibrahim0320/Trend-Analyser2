// api/research/refresh.js
import { prisma } from '../../lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { region = 'All' } = req.body || {};
    const wl = await prisma.watchlist.findUnique({ where: { region } }).catch(() => null);
    const keys = (wl?.keywords?.length ? wl.keywords : ['trenchcoat', 'loafers', 'quiet luxury']).slice(0, 10);

    // deterministic-ish seed so refresh feels stable between runs
    const seed = (region + ':' + keys.join('|'))
      .split('')
      .reduce((a, c) => (a * 33 + c.charCodeAt(0)) >>> 0, 5381);

    const rnd = (i) => {
      let x = (seed ^ (i + 1) * 2654435761) >>> 0;
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      return (x >>> 0) / 2 ** 32;
    };

    const rows = keys.map((theme, i) => {
      const heat = 40 + Math.round(rnd(i) * 50);
      const momentum = rnd(i + 7) > 0.49 ? 1 : -1;
      const forecast_heat = Math.min(100, Math.round(heat + (momentum > 0 ? rnd(i + 11) * 10 : -rnd(i + 13) * 8)));
      const confidence = Number((0.42 + rnd(i + 17) * 0.3).toFixed(2));
      const awa = confidence > 0.62 && heat > 65 ? 'ACT' : 'WATCH';
      return { region, theme, heat, momentum, forecast_heat, confidence, act_watch_avoid: awa, links: [] };
    });

    // Persist as new snapshots (your /api/themes/top reads by createdAt desc)
    await prisma.$transaction(rows.map((r) => prisma.theme.create({ data: r })));

    const data = rows
      .sort((a, b) => b.heat - a.heat)
      .map((r) => ({
        theme: r.theme,
        heat: r.heat,
        momentum: r.momentum,
        forecast_heat: r.forecast_heat,
        confidence: r.confidence,
        act_watch_avoid: r.act_watch_avoid,
        links: r.links,
      }));

    return res.status(200).json({ themes: data });
  } catch (e) {
    console.error('[research/refresh] error', e);
    return res.status(500).json({ error: 'Internal error' });
  }
}
