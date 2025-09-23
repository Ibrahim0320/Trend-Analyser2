// /lib/ai.js
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'; // small + fast default

export async function generateBullets({ region, entities }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { bullets: heuristicBullets({ region, entities }), provider: 'heuristic' };

  const themes = entities.map(e => e.entity);
  const sys = `You are a sharp trend analyst. Write 3 punchy bullets. 
Each bullet: 1 sentence, max 22 words, active voice. 
Avoid clichés. Mention ${region} when relevant.`;

  const user = `Themes: ${themes.join(', ')}.
Signals: ${JSON.stringify(entities).slice(0, 8000)}`;

  try {
    const res = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${key}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: user },
        ],
        temperature: 0.5,
      }),
    });

    if (!res.ok) throw new Error(`openai ${res.status}`);
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? '';
    const bullets = text
      .split('\n')
      .map(s => s.replace(/^[\-\*\d\.\s]+/, '').trim())
      .filter(Boolean)
      .slice(0, 3);

    if (!bullets.length) throw new Error('empty');
    return { bullets, provider: 'openai' };
  } catch {
    return { bullets: heuristicBullets({ region, entities }), provider: 'heuristic' };
  }
}

function heuristicBullets({ region, entities }) {
  const top = entities
    .map(e => ({
      entity: e.entity,
      s: (e.agg?.engagement ?? 0) * 0.6 + (e.agg?.authority ?? 0) * 0.4,
    }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 3);

  if (!top.length) {
    return [
      `Signals are limited; broaden keywords or re-run to enrich results in ${region}.`,
      `Add brand terms plus product categories to improve coverage.`,
      `Use the link icons to verify top sources and refine themes.`,
    ];
  }

  return top.map(({ entity }) => {
    return `Momentum for “${entity}” is consolidating in ${region}; pair organic demand with authority-led content to stay visible.`;
  });
}
