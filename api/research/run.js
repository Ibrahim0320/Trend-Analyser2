// api/research/run.js
export const config = { runtime: 'nodejs' };

import { prisma } from '../../lib/db.js';

/**
 * POST /api/research/run
 * body: { region: string, keywords: string[] }
 */
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    // ensure env
    if (!process.env.DATABASE_URL) throw new Error('Missing DATABASE_URL');
    if (!process.env.OPENAI_API_KEY) throw new Error('Missing OPENAI_API_KEY');

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const region = String(body.region || 'All');
    const keywords = Array.isArray(body.keywords) ? body.keywords.map(s => String(s)) : [];

    // touch DB to confirm connectivity (fast)
    await prisma.$queryRawUnsafe('select 1');

    // ---- Your existing research pipeline goes here ----
    // Keep placeholder so the route works while you iterate sources/models.
    const result = {
      created_at: new Date().toISOString(),
      region,
      keywords,
      rising: [],
      whyMatters: 'Signals pipeline placeholder. DB + keys verified; add sources/model next.',
      aheadOfCurve: [],
      leaders: [],
      citations: [],
      sourceCounts: { trends: 0, youtube: 0, gdelt: 0, reddit: 0 },
    };

    return res.status(200).json({ ok: true, data: result });
  } catch (err) {
    console.error('[api/research/run] error:', err);
    // Always return a JSON error so the UI can show a reason
    return res.status(500).json({
      ok: false,
      error: err?.message || String(err),
      code: err?.code || null,
      meta: err?.meta || null,
    });
  }
}
