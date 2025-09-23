// api/briefs/insight.js
import { getOpenAI } from '../../lib/openai.js';
export const config = { runtime: 'nodejs' };

function heuristicBullets(region, entities = []) {
  const top = [...(entities || [])].slice(0, 3);
  if (!top.length) return [
    'Engagement is consolidating; expand tests across YouTube + news.',
    'Prioritize evergreen themes; creative refresh > channel expansion.',
    'Track authority climb weekly to validate momentum claims.'
  ];
  return top.map((e) => {
    const t = e.top?.[0] || {};
    const name = e.entity;
    const auth = Math.round((t.authority || 0) * 100);
    const eng = Math.round((t.engagement || 0) * 100);
    return `${name}: ${eng}% engagement, ${auth}% authority in ${region}; test creators + short-form hooks.`;
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { region = 'All', entities = [] } = req.body || {};
    const openai = (() => {
      try { return getOpenAI?.(); } catch { return null; }
    })();

    if (!openai) {
      return res.status(200).json({ ok: true, bullets: heuristicBullets(region, entities) });
    }

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

    try {
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

      return res.status(200).json({ ok: true, bullets: bullets.length ? bullets : heuristicBullets(region, entities) });
    } catch {
      // Fall back if API rate-limits/errors
      return res.status(200).json({ ok: true, bullets: heuristicBullets(region, entities) });
    }
  } catch (err) {
    console.error('[briefs/insight] error', err);
    return res.status(200).json({ ok: true, bullets: [] });
  }
}
