// api/themes/leaders.js
import { prisma } from '../../lib/db.js';

export const config = { runtime: 'nodejs' };

/**
 * Returns top sources (creators/domains/etc.) ranked by authority + engagement
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

    // last 500 signals for region (best-effort)
    const signals = await prisma.signal.findMany({
      where: { region },
      orderBy: { observedAt: 'desc' },
      take: 500,
      select: {
        provider: true,
        sourceId: true,
        engagement: true,
        authority: true,
      },
    });

    const map = new Map();
    for (const s of signals) {
      const key = `${s.provider}:${s.sourceId || 'unknown'}`;
      const rec = map.get(key) || { key, provider: s.provider, source: s.sourceId || 'unknown', n: 0, eng: 0, auth: 0 };
      rec.n += 1;
      rec.eng += Number(s.engagement || 0);
      rec.auth += Number(s.authority || 0);
      map.set(key, rec);
    }

    const rows = [...map.values()].map((r) => ({
      key: r.key,
      provider: r.provider,
      source: r.source,
      avgEng: r.n ? r.eng / r.n : 0,
      authority: r.n ? r.auth / r.n : 0,
      rank: 0.5 * (r.n ? r.eng / r.n : 0) + 0.5 * (r.n ? r.auth / r.n : 0),
    }));

    rows.sort((a, b) => b.rank - a.rank);

    return res.status(200).json({ ok: true, data: rows.slice(0, limit) });
  } catch (err) {
    console.error('[leaders] error', err);
    return res.status(200).json({ ok: true, data: [] }); // fail-soft for UI
  }
}
