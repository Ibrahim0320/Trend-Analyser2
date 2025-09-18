// api/research/watchlist.js
import { prisma } from '../../lib/db.js';

export default async function handler(req, res) {
  const region = String(req.query.region || req.body?.region || 'All');

  try {
    if (req.method === 'GET') {
      const wl = await prisma.watchlist.findUnique({ where: { region } }).catch(()=>null);
      return res.status(200).json({ region, keywords: wl?.keywords || [] });
    }

    if (req.method === 'POST') {
      const { keywords = [] } = req.body || {};
      const unique = Array.from(new Set((keywords || []).map(s => String(s).toLowerCase().trim()).filter(Boolean)));
      await prisma.watchlist.upsert({
        where: { region },
        update: { keywords: unique },
        create: { region, keywords: unique }
      });
      return res.status(200).json({ region, keywords: unique });
    }

    if (req.method === 'PATCH') {
      const { add = [], remove = [] } = req.body || {};
      const wl = await prisma.watchlist.findUnique({ where: { region } });
      const current = new Set(wl?.keywords || []);
      add.forEach(k => current.add(String(k).toLowerCase().trim()));
      remove.forEach(k => current.delete(String(k).toLowerCase().trim()));
      const next = Array.from(current);
      await prisma.watchlist.upsert({
        where: { region },
        update: { keywords: next },
        create: { region, keywords: next }
      });
      return res.status(200).json({ region, keywords: next });
    }

    if (req.method === 'DELETE') {
      await prisma.watchlist.delete({ where: { region } }).catch(()=>null);
      return res.status(200).json({ region, keywords: [] });
    }

    res.setHeader('Allow', ['GET','POST','PATCH','DELETE']);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[research/watchlist] error', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
