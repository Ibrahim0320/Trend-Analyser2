// api/research/watchlist.js
import { prisma } from '../../lib/db.js';
export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  const region = (req.query.region || req.body?.region || 'All').trim();

  try {
    if (req.method === 'GET') {
      const w = await prisma.watchlist.findUnique({ where: { region } });
      res.status(200).json({ ok:true, keywords: w?.keywords || [] });
      return;
    }

    if (req.method === 'POST') {
      const { keywords = [] } = req.body || {};
      const kw = [...new Set(keywords.map(k=>k.trim()).filter(Boolean))];
      const w = await prisma.watchlist.upsert({
        where: { region },
        update: { keywords: kw },
        create: { region, keywords: kw }
      });
      res.status(200).json({ ok:true, keywords: w.keywords });
      return;
    }

    if (req.method === 'PATCH') {
      const { remove = [] } = req.body || {};
      const w = await prisma.watchlist.findUnique({ where: { region } });
      const next = (w?.keywords || []).filter(k => !remove.includes(k));
      const w2 = await prisma.watchlist.upsert({
        where: { region },
        update: { keywords: next },
        create: { region, keywords: next }
      });
      res.status(200).json({ ok:true, keywords: w2.keywords });
      return;
    }

    if (req.method === 'DELETE') {
      await prisma.watchlist.delete({ where: { region } }).catch(()=>{});
      res.status(200).json({ ok:true });
      return;
    }

    res.status(405).json({ ok:false, error:'Method not allowed' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error:'Server error' });
  }
}
