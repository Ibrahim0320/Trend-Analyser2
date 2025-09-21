export const config = { runtime: 'nodejs' };
import { prisma } from '../../lib/db.js';
export default async function handler(req, res) {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
}
