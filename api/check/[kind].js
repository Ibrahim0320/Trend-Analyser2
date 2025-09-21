// api/check/[kind].js
export const config = { runtime: 'nodejs' };
import { prisma } from '../../lib/db.js';

export default async function handler(req, res) {
  const kind = req.query.kind; // 'db' | 'openai'
  try {
    if (kind === 'db') {
      await prisma.$queryRaw`SELECT 1`;
      return res.status(200).json({ ok: true });
    }
    if (kind === 'openai') {
      const ok = !!process.env.OPENAI_API_KEY;
      return res.status(ok ? 200 : 500).json({ ok });
    }
    return res.status(404).json({ ok: false, error: 'unknown check' });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.code ? `${e.code}: ${e.message}` : e) });
  }
}
