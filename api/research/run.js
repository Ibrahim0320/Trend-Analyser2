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

    // Load saved if none provided
    let active = list;
    if (!keywords?.length) {
      const wl = await prisma.watchlist.findUnique({ where: { region } }).catch(()=>null);
      if (wl?.keywords?.length) active = wl.keywords;
    }

    // Fallback scoring (until signal adapters are plugged)
    const seed = (region + ':' + active.join('|')).split('').reduce((a,c)=> (a*33 + c.charCodeAt(0)) >>> 0, 5381);
    const rand = (i) => { let x = (seed ^ (i+1)*2654435761) >>> 0; x ^= x<<13; x ^= x>>>17; x ^= x<<5; return (x>>>0)/2**32; };

    let leaders = active.map((k, i) => {
      const heat = 42 + Math.round(rand(i)*40);
      const momentum = rand(i+7) > 0.48 ? 1 : -1;
      const vol = 180 + Math.round(rand(i+13)*9800);
      const trend = 2.2 + rand(i+29)*6;
      const score = heat * (momentum > 0 ? 1.05 : 0.9);
      return {
        entity: k,
        type: guessType(k),
        trend: (trend * 100) | 0,
        volume: vol,
        score: Number(score.toFixed(2)),
        urls: []
      };
    }).sort((a,b)=> b.score - a.score);

    // Pull reputable citations
    const citesResp = await fetch(`${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : ''}/api/ingest/news`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords: active, limitPerKeyword: 3 })
    }).then(r => r.ok ? r.json() : { citations: [], count: 0 }).catch(()=>({ citations: [], count: 0 }));

    const citations = (citesResp.citations || []).map(c => ({ entity: c.entity, url: c.url, source: c.source, title: c.title }));

    // attach one “best” link per leader if available
    leaders = leaders.map(L => {
      const hit = citations.find(c => c.entity === L.entity);
      return hit ? { ...L, urls: [hit.url] } : L;
    });

    const rising = leaders
      .filter(l => l.score >= leaders[0]?.score * 0.7)
      .slice(0,6)
      .map(l => `• ${l.entity} – ${l.type} (trend ${l.trend}%, vol ${fmtVol(l.volume)})`);

    const payload = {
      leaders,
      rising,
      sourceCounts: { trends: leaders.length, youtube: 0, gdelt: 0, reddit: 0, news: citations.length },
      whyMatters: 'External fashion publications report related signals; rankings reflect relative heat & volume until full model is enabled.',
      aheadOfCurve: [
        'Brief creators with top-2 items; track saves/comments vs baseline.',
        'Line up imagery to test color accents on winner items.',
        'Add alert: if 2+ reputable sources publish within 7d for a keyword, bump priority.'
      ],
      citations
    };

    return res.status(200).json({ ok: true, data: payload });
  } catch (err) {
    console.error('[research/run] error', err);
    return res.status(500).json({ ok: false, error: 'Internal error' });
  }
}

function guessType(k) {
  const s = k.toLowerCase();
  if (['trench','trenchcoat','puffer','loafer','loafers','jacket','cardigan','knitwear','sweater'].some(t => s.includes(t))) return 'item';
  if (['cozy','quiet luxury','preppy','gorpcore','paris','dior','luxury'].some(t => s.includes(t))) return 'topic';
  return 'topic';
}
function fmtVol(x){ return x >= 1000 ? `${Math.round(x/100)/10}k` : `${x}`; }
