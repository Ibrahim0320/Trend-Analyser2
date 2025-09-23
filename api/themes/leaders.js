// api/themes/leaders.js
import { prisma } from '../../lib/db.js';
export const config = { runtime: 'nodejs' };

/**
 * Leaders ranked by blended authority + engagement per (provider, entity).
 * Query: ?region=Nordics&limit=8
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const region = String(req.query.region || 'All');
    const limit = Math.min(Math.max(parseInt(req.query.limit || '8', 10), 1), 25);

    const signals = await prisma.signal.findMany({
      where: { region },
      orderBy: { observedAt: 'desc' },
      take: 800,
      select: {
        provider: true,
        entity: true,
        engagement: true,
        authority: true,
      },
    });

    const map = new Map();
    for (const s of signals) {
      const key = `${s.provider}:${s.entity}`;
      const rec = map.get(key) || { key, provider: s.provider, source: s.entity, n: 0, eng: 0, auth: 0 };
      rec.n += 1;
      rec.eng += Number(s.engagement || 0);
      rec.auth += Number(s.authority || 0);
      map.set(key, rec);
    }

    let rows = [...map.values()].map((r) => {
      const avgEng = r.n ? r.eng / r.n : 0;
      const avgAuth = r.n ? r.auth / r.n : 0;
      return {
        key: r.key,
        provider: r.provider,
        source: r.source,       // show the theme/entity as “source”
        avgEng,
        authority: avgAuth,
        rank: 0.55 * avgAuth + 0.45 * avgEng, // bias to authority a bit
      };
    });

    rows.sort((a, b) => b.rank - a.rank);
    rows = rows.slice(0, limit);

    return res.status(200).json({ ok: true, data: rows });
  } catch (err) {
    console.error('[leaders] error', err);
    // Fail-soft so the UI doesn’t look broken
    return res.status(200).json({ ok: true, data: [] });
  }
}
