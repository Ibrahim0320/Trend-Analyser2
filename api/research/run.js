// api/research/run.js
import { prisma } from '../../lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { region = 'All', keywords = [] } = req.body || {};
    const list = (Array.isArray(keywords) && keywords.length ? keywords : ['trenchcoat','loafers','quiet luxury'])
      .slice(0, 12)
      .map(s => String(s).toLowerCase().trim())
      .filter(Boolean);

    // Try read saved list if none provided
    let active = list;
    if (!keywords?.length) {
      const wl = await prisma.watchlist.findUnique({ where: { region } }).catch(()=>null);
      if (wl?.keywords?.length) active = wl.keywords;
    }

    // --- Fallback scorer (until external adapters are wired) -----------------
    // Deterministic pseudo-signal so you get stable results across deploys.
    const seed = (region + ':' + active.join('|')).split('').reduce((a,c)=> (a*33 + c.charCodeAt(0)) >>> 0, 5381);
    const rand = (i) => {
      // xorshift
      let x = (seed ^ (i+1)*2654435761) >>> 0;
      x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
      return (x >>> 0) / 2**32;
    };

    const leaders = active.map((k, i) => {
      const heat = 42 + Math.round(rand(i)*40);              // 42..82
      const momentum = rand(i+7) > 0.48 ? 1 : -1;            // up/down arrow
      const vol = 180 + Math.round(rand(i+13)*9800);         // ~200..10k
      const trend = 2.2 + rand(i+29)*6;                      // x-over-baseline
      const score = heat * (momentum > 0 ? 1.05 : 0.9);
      return {
        entity: k,
        type: guessType(k),
        trend: (trend * 100) | 0,          // show as %
        volume: vol,
        score: Number(score.toFixed(2)),
        urls: [] // we’ll fill these when solid sources are plugged
      };
    }).sort((a,b)=> b.score - a.score);

    const rising = leaders
      .filter(l => l.score >= leaders[0]?.score * 0.7)
      .slice(0,6)
      .map(l => `• ${l.entity} – ${l.type} (trend ${l.trend}%, vol ${fmtVol(l.volume)})`);

    const payload = {
      leaders,
      rising,
      sourceCounts: { trends: leaders.length, youtube: 0, gdelt: 0, reddit: 0 },
      whyMatters: 'Signals pipeline placeholder. DB + keys verified; add sources/model next.',
      aheadOfCurve: [
        'Prototype 3 looks & test creatives; measure saves/comments vs baseline.',
        'Pre-book core neutrals; validate a bold accent color in small buy.',
        'Add alert: 7-day heat > 1.3× across ≥2 sources (when sources are live).'
      ],
      citations: [] // we’ll populate with {entity,url} once adapters are enabled
    };

    return res.status(200).json({ ok: true, data: payload });
  } catch (err) {
    console.error('[research/run] error', err);
    return res.status(500).json({ ok: false, error: 'Internal error' });
  }
}

function guessType(k) {
  const s = k.toLowerCase();
  if (['trench','trenchcoat','puffer','loafer','loafer(s)','jacket','cardigan'].some(t => s.includes(t))) return 'item';
  if (['cozy','quiet luxury','preppy','gorpcore','paris','dior'].some(t => s.includes(t))) return 'topic';
  return 'topic';
}
function fmtVol(x){ return x >= 1000 ? `${Math.round(x/100)/10}k` : `${x}`; }
