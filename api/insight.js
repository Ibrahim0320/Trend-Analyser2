// /api/insight.js
import { InsightSchema } from '../lib/validation.js';
import { generateBullets } from '../lib/ai.js';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const parsed = InsightSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    const { region, entities } = parsed.data;
    const { bullets, provider } = await generateBullets({ region, entities });

    return res.status(200).json({ ok: true, bullets, provider });
  } catch (err) {
    console.error('[insight] error', err);
    // Keep UI responsive with a graceful fallback
    return res.status(200).json({
      ok: true,
      bullets: [
        'Signals processed, but the explainer is busy. Re-run in a moment.',
        'Mix product + brand + niche terms to enrich coverage.',
        'Use the link icons to validate sources quickly.',
      ],
      provider: 'fallback',
    });
  }
}
