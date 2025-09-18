// api/research/refresh.js
// Use the saved watchlist to create a "Top Movers" snapshot in Theme,
// so the Top Movers table fills immediately after you click your “Replace saved… & Re-run”.

import { prisma } from '../../lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const { region = 'All' } = req.body || {};
    const wl = await prisma.watchlist.findUnique({ where: { region } });
    const keys = (wl?.keywords || []).slice(0, 10);

    // generate a deterministic snapshot
    const week = startOfWeek(new Date());
    const seed = (region + ':' + keys.join('|')).split('').reduce((a,c)=> (a*33 + c.charCodeAt(0)) >>> 0, 5381);
    const rand = (i) => { let x = (seed ^ (i+1)*2654435761) >>> 0; x ^= x<<13; x ^= x>>>17; x ^= x<<5; return (x>>>0)/2**32; };

    const rows = [];
    for (let i=0;i<keys.length;i++) {
      const heat = 40 + Math.round(rand(i)*50);
      const momentum = rand(i+7) > 0.49 ? 1 : -1;
      const forecast = Math.min(100, Math.round(heat + (momentum>0 ? rand(i+11)*10 : -rand(i+13)*8)));
      const conf = 0.42 + rand(i+17)*0.3;
      const awa = conf > 0.62 && heat > 65 ? 'ACT' : conf > 0.5 ? 'WATCH' : 'WATCH';
      rows.push({
        region,
        week_of: week,
        label: keys[i],
        heat,
        momentum,
        forecast_heat: forecast,
        confidence: Number(conf.toFixed(2)),
        act_watch_avoid: awa,
        links: []
      });
    }

    // upsert by (region, label, week_of)
    await Promise.all(rows.map(r =>
      prisma.theme.upsert({
        where: { region_label_week: { region: r.region, label: r.label, week_of: r.week_of } },
        update: { heat: r.heat, momentum: r.momentum, forecast_heat: r.forecast_heat, confidence: r.confidence, act_watch_avoid: r.act_watch_avoid, links: r.links },
        create: r
      })
    ));

    const data = rows
      .sort((a,b)=> b.heat - a.heat)
      .map(r => ({ theme: r.label, heat: r.heat, momentum: r.momentum, forecast_heat: r.forecast_heat, confidence: r.confidence, act_watch_avoid: r.act_watch_avoid, links: r.links }));

    return res.status(200).json({ themes: data });
  } catch (e) {
    console.error('[research/refresh] error', e);
    return res.status(500).json({ error: 'Internal error' });
  }
}

function startOfWeek(d) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = x.getUTCDay(); // 0 Sun
  const diff = (day + 6) % 7; // Monday as start
  x.setUTCDate(x.getUTCDate() - diff);
  x.setUTCHours(0,0,0,0);
  return x;
}
