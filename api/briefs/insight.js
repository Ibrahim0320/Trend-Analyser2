// /api/briefs/insight.js
import { InsightSchema } from '../../lib/validation.js';
import { generateBullets } from '../../lib/ai.js';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const parsed = InsightSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    const { region, entities } = parsed.data;
    const { bullets, provider } = await generateBullets({ region, entities });

    res.status(200).json({ ok: true, bullets, provider });
  } catch (err) {
    console.error('[briefs/insight] error', err);
    res.status(200).json({
      ok: true,
      bullets: [
        'Signals were processed but explanation service is busy. Try again in a moment.',
        'Refine keywords to a mix of product + brand + niche.',
        'Use the link icons to validate sources quickly.',
      ],
      provider: 'fallback',
    });
  }
}
