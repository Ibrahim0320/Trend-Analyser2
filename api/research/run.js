// api/research/run.js
export const config = { runtime: 'nodejs' };

import { prisma } from '../../lib/db.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const { region, keywords = [] } = body;

    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL not set');
    }
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not set');
    }

    // ---- your existing research logic here ----
    // Example placeholder so it doesn’t crash while we debug DB:
    // (swap this with your real runner once DB is confirmed ok)
    const result = {
      created_at: new Date().toISOString(),
      region,
      keywords,
      rising: [],
      whyMatters: 'Placeholder while we verify DB & keys.',
      aheadOfCurve: [],
      leaders: [],
      citations: [],
      sourceCounts: { trends: 0, youtube: 0, gdelt: 0, reddit: 0 },
    };

    // touch DB to confirm connectivity
    await prisma.$queryRawUnsafe('SELECT 1');

    return res.status(200).json({ ok: true, data: result });
  } catch (err) {
    console.error('[/api/research/run] error:', err);
    return res.status(500).json({
      ok: false,
      error: err?.message || String(err),
      code: err?.code,
      meta: err?.meta || null,
    });
  }
}
