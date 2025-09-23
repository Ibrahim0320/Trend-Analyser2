// api/briefs/insight.js
import { getOpenAI } from '../../lib/openai.js';

export const config = { runtime: 'nodejs' };

/**
 * POST { region, entities }
 * entities: [{ entity, top:[{provider, authority, engagement, velocity, score}], agg:{...} }]
 * Returns: { bullets: string[] }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { region = 'All', entities = [] } = req.body || {};

    // Build a tiny prompt — keep it deterministic and short
    const summary = entities.slice(0, 5).map(e => {
      const t = e.top?.[0] || {};
      return `${e.entity}: score ${t.score ?? 0}, vel ${t.velocity ?? 0}, auth ${t.authority ?? 0}, eng ${t.engagement ?? 0}`;
    }).join('\n');

    const prompt = `You are a concise trend analyst.
Region: ${region}
Top themes (score/vel/auth/eng):
${summary}

Write 3 crisp bullets on why these shifts matter for fashion/lifestyle marketers.
Be specific, avoid fluff, <120 chars per bullet, no numbering. Return bullets only.`;

    const openai = getOpenAI();
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      messages: [
        { role: 'system', content: 'You write brief, actionable insights.' },
        { role: 'user', content: prompt },
      ],
    });

    const text = resp?.choices?.[0]?.message?.content || '';
    const bullets = text
      .split('\n')
      .map(s => s.replace(/^[-•\d\.\)\s]+/, '').trim())
      .filter(Boolean)
      .slice(0, 4);

    return res.status(200).json({ ok: true, bullets });
  } catch (err) {
    console.error('[briefs/insight] error', err);
    return res.status(200).json({ ok: true, bullets: [] }); // UI can still render empty state
  }
}
