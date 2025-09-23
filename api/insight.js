// /api/insight.js
import { InsightSchema } from '../lib/validation.js';
import { generateBullets } from '../lib/ai.js';

// Ensure Node runtime on Vercel
export const config = { runtime: 'nodejs' };

/**
 * POST /api/insight
 * Body: { region: string, entities: Array<{ entity: string, agg?: { engagement?: number, authority?: number } }> }
 * Returns: { ok: true, bullets: string[], provider: 'openai' | 'heuristic' | 'fallback' }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const parsed = InsightSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    const { region, entities } = parsed.data;

    // Try to generate bullets via AI (generateBullets already falls back if needed)
    const { bullets, provider } = await generateBullets({ region, entities });

    return res.status(200).json({ ok: true, bullets, provider });
  } catch (err) {
    console.error('[api/insight] error', err);
    // Never 500 the client—return a safe fallback so UI can keep rendering
    return res.status(200).json({
      ok: true,
      bullets: [
        'Signals collected successfully, but the explainer is busy—try again shortly.',
        'Refine keywords to a mix of brand + product + niche for clearer intent.',
        'Use the link icons in the table to spot-check source quality quickly.',
      ],
      provider: 'fallback',
    });
  }
}
