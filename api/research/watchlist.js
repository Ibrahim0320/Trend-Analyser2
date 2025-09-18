// api/research/watchlist.js
export const config = { runtime: 'nodejs' };

import { prisma } from '../../lib/db.js';

/**
 * GET    /api/research/watchlist?region=Nordics   → { keywords: [...] }
 * POST   /api/research/watchlist {region, keywords: [...] } → upsert
 * PATCH  /api/research/watchlist {region, remove: [...] }  → remove specific
 * DELETE /api/research/watchlist?region=Nordics            → clear
 *
 * Backed by a simple key-value table: watchlists(region TEXT PK, keywords JSONB, updated_at)
 * If you don’t have this table yet, create it with:
 *   npx prisma db push
 */
export default async function handler(req, res) {
  try {
    const region = String(req.query.region || (typeof req.body === 'string' ? JSON.parse(req.body).region : req.body?.region || 'All'));

    if (req.method === 'GET') {
      const row = await prisma.watchlist.findUnique({ where: { region } });
      return res.status(200).json({ keywords: row?.keywords || [] });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const keywords = Array.isArray(body.keywords) ? body.keywords.map(s => String(s)) : [];
      await prisma.watchlist.upsert({
        where: { region },
        update: { keywords, updated_at: new Date() },
        create: { region, keywords, updated_at: new Date() },
      });
      return res.status(200).json({ ok: true, keywords });
    }

    if (req.method === 'PATCH') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const remove = new Set(Array.isArray(body.remove) ? body.remove.map(s => String(s)) : []);
      const row = await prisma.watchlist.findUnique({ where: { region } });
      const next = (row?.keywords || []).filter(k => !remove.has(k));
      await prisma.watchlist.upsert({
        where: { region },
        update: { keywords: next, updated_at: new Date() },
        create: { region, keywords: next, updated_at: new Date() },
      });
      return res.status(200).json({ ok: true, keywords: next });
    }

    if (req.method === 'DELETE') {
      await prisma.watchlist.deleteMany({ where: { region } });
      return res.status(200).json({ ok: true, keywords: [] });
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (err) {
    console.error('[api/research/watchlist] error:', err);
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
}
