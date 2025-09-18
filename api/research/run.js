// api/research/run.js
export const config = { runtime: 'nodejs' };

import { prisma } from '../../lib/db.js';

// --- helpers: you already have your real compute; keep yours and
// map its results into {leaders, rising, citations, whyMatters, aheadOfCurve}.
// The createThemesFromRun() just translates leaders -> Theme rows.

function pickAWA(heat, momentum = 0) {
  if (heat >= 70 && momentum >= 0) return 'ACT';
  if (heat <= 35 && momentum < 0) return 'AVOID';
  return 'WATCH';
}

function entityLink(entity, citations = []) {
  const hit = citations.find(c => (c.entity || '').toLowerCase() === (entity || '').toLowerCase());
  return hit?.url || null;
}

// Convert leaders -> Theme rows we persist for the "Top Movers" table.
function createThemesFromRun({ region, leaders = [], citations = [] }) {
  // Normalize a 0–100 "heat" from score if present; otherwise from volume.
  // Feel free to swap in your actual scoring logic.
  const maxScore = Math.max(1, ...leaders.map(l => Number(l.score) || 0));
  const maxVol   = Math.max(1, ...leaders.map(l => Number(l.volume) || 0));

  return leaders.slice(0, 12).map((l, idx) => {
    const score = Number(l.score) || 0;
    const volume = Number(l.volume) || 0;
    const heatFromScore = Math.round((score / maxScore) * 100);
    const heatFromVol   = Math.round((volume / maxVol) * 100);
    const heat = Number.isFinite(heatFromScore) && heatFromScore > 0 ? heatFromScore : heatFromVol;

    const momentum = idx === 0 ? 1 : (idx < 4 ? 1 : -1); // placeholder momentum until your real signal lands
    const forecast_heat = Math.min(100, Math.max(0, Math.round(heat + momentum * 5)));
    const confidence = 0.5; // placeholder; wire up your true confidence later
    const awa = pickAWA(heat, momentum);

    const link = entityLink(l.entity, citations);

    return {
      region,
      theme: l.entity,
      heat,
      momentum,
      forecast_heat,
      confidence,
      act_watch_avoid: awa,
      links: link ? [link] : [],
    };
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { region = 'All', keywords = [] } = req.body || {};

    // --- Your existing compute goes here. For clarity, I’ll stub a minimal result using
    // what you already see on-screen, but keep your real code in place.
    // Return shape must include: leaders[], rising[], citations[], whyMatters, aheadOfCurve[].

    const result = await runYourExistingResearch({ region, keywords });
    // result = { leaders, rising, citations, whyMatters, aheadOfCurve }

    // --- Persist snapshot for Top Movers
    const themes = createThemesFromRun({ region, leaders: result.leaders, citations: result.citations });

    // Store a rolling snapshot (last 7d) or simply append; here we upsert by (region, theme, day).
    const today = new Date();
    const yyyy = today.getUTCFullYear();
    const mm = String(today.getUTCMonth() + 1).padStart(2,'0');
    const dd = String(today.getUTCDate()).padStart(2,'0');
    const dayKey = `${yyyy}-${mm}-${dd}`;

    // Upsert each theme row for today
    await Promise.all(themes.map(t =>
      prisma.theme.upsert({
        where: { region_theme_day: { region: t.region, theme: t.theme, dayKey } },
        update: {
          heat: t.heat,
          momentum: t.momentum,
          forecast_heat: t.forecast_heat,
          confidence: t.confidence,
          act_watch_avoid: t.act_watch_avoid,
          links: t.links,
          updatedAt: new Date()
        },
        create: {
          region: t.region,
          theme: t.theme,
          dayKey,
          heat: t.heat,
          momentum: t.momentum,
          forecast_heat: t.forecast_heat,
          confidence: t.confidence,
          act_watch_avoid: t.act_watch_avoid,
          links: t.links
        }
      })
    ));

    // (Optional) also store current watchlist for this region so the UI’s saved list can be used later
    if (Array.isArray(keywords) && keywords.length) {
      await prisma.watchlist.upsert({
        where: { region },
        update: { keywords },
        create: { region, keywords }
      });
    }

    // Bubble the research payload to the client
    return res.status(200).json({ ok: true, data: result });

  } catch (err) {
    console.error('research/run error', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}

/**
 * plug in your existing implementation; keep signature & fields.
 * Must resolve:
 * {
 *   leaders: [{ entity, type, trend, volume, score, urls? }...],
 *   rising:  [ "• trench — item (trend 500%, vol 10.1k)", ... ],
 *   citations: [{ entity, url, source? }...],
 *   whyMatters: string,
 *   aheadOfCurve: string[]
 * }
 */
async function runYourExistingResearch({ region, keywords }) {
  // *** replace this stub with your real pipeline ***
  return {
    leaders: [
      { entity: 'trenchcoat', type: 'item', trend: 3.93, volume: 3800, score: 64.8, urls: [] },
      { entity: 'loafers', type: 'item', trend: 6.17, volume: 9900, score: 52.5, urls: [] },
      { entity: 'quiet luxury', type: 'topic', trend: 6.43, volume: 5200, score: 52.2, urls: [] },
    ],
    rising: [
      '• trenchcoat – item (trend 393%, vol 3.8k)',
      '• loafers – item (trend 617%, vol 9.9k)',
      '• quiet luxury – topic (trend 643%, vol 5.2k)',
    ],
    citations: [
      { entity: 'trenchcoat', url: 'https://www.vogue.com/fashion/trenchcoat-2025' },
      { entity: 'loafers', url: 'https://www.harpersbazaar.com/fashion/loafers-trend' },
      { entity: 'quiet luxury', url: 'https://www.whowhatwear.com/quiet-luxury-2025' }
    ],
    whyMatters: 'External fashion publications report related signals; rankings reflect relative heat & volume until full model is enabled.',
    aheadOfCurve: [
      'Brief creators with top–2 items; track saves/comments vs baseline.',
      'Line up imagery to test color accents on winner items.',
      'Add alert: if 2+ reputable sources publish within 7d for a keyword, bump priority.'
    ]
  };
}
