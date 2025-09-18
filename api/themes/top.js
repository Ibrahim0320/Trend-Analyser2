// api/themes/top.js
import { prisma } from '../../lib/db.js';
export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  try {
    const { region = 'All', limit = 10 } = req.query;
    const rows = await prisma.theme.findMany({
      where: { region },
      orderBy: { createdAt: 'desc' },
      take: Number(limit)
    });
    res.status(200).json({ ok:true, data: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error:'Server error' });
  }
}
