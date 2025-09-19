// api/ingest/news.js
// Pulls RSS from reputable fashion publications and returns
// scored links per keyword. Dependency-free (no extra packages).

export const config = { runtime: 'nodejs' };

const FASHION_FEEDS = [
  { name: 'Vogue',                 rss: 'https://www.vogue.com/rss',                       w: 1.0 },
  { name: 'Business of Fashion',   rss: 'https://www.businessoffashion.com/feed',          w: 1.0 },
  { name: 'WWD',                   rss: 'https://wwd.com/feed/',                           w: 0.9 },
  { name: 'The Guardian – Fashion',rss: 'https://www.theguardian.com/fashion/rss',         w: 0.9 },
  { name: 'GQ',                    rss: 'https://www.gq.com/rss',                          w: 0.8 },
  { name: 'ELLE',                  rss: 'https://www.elle.com/rss/all.xml',                w: 0.8 },
  { name: 'Harper’s Bazaar',       rss: 'https://www.harpersbazaar.com/rss/all.xml',       w: 0.8 },
  { name: 'Highsnobiety',          rss: 'https://www.highsnobiety.com/rss',                w: 0.7 },
  { name: 'Hypebeast',             rss: 'https://hypebeast.com/feed',                      w: 0.7 },
];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const { keywords = [], limitPerKeyword = 3 } = req.body || {};
    const keys = (Array.isArray(keywords) ? keywords : []).map(s => String(s).toLowerCase().trim()).filter(Boolean);
    if (!keys.length) return res.status(200).json({ citations: [], count: 0 });

    const xmls = await Promise.all(FASHION_FEEDS.map(async (f) => {
      try {
        const r = await fetch(f.rss, { headers: { 'User-Agent': 'TrendAnalyser/1.0' } });
        return r.ok ? await r.text() : null;
      } catch { return null; }
    }));

    // Parse all items
    const items = [];
    for (let i = 0; i < xmls.length; i++) {
      const xml = xmls[i];
      if (!xml) continue;
      for (const it of parseRSS(xml)) {
        items.push({
          source: FASHION_FEEDS[i].name,
          w: FASHION_FEEDS[i].w,
          title: clean(it.title),
          summary: clean(it.description || it.content || ''),
          link: it.link,
          pub: it.pubDate ? new Date(it.pubDate).getTime() : 0,
        });
      }
    }

    // Score per keyword
    const citations = [];
    for (const kw of keys) {
      const scored = items
        .map(it => ({
          it,
          score:
            matchScore(it.title, kw) * 1.2 +
            matchScore(it.summary, kw) * 0.8 +
            recencyBoost(it.pub) +
            it.w * 0.5,
        }))
        .filter(x => x.score > 0.6)
        .sort((a,b) => b.score - a.score)
        .slice(0, limitPerKeyword)
        .map(s => ({ entity: kw, url: s.it.link, source: s.it.source, title: s.it.title }));
      for (const c of dedupe(scored)) citations.push(c);
    }

    return res.status(200).json({ citations, count: citations.length });
  } catch (e) {
    console.error('[ingest/news] error', e);
    return res.status(500).json({ error: 'Internal error' });
  }
}

function clean(s=''){ return s.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim(); }
function parseRSS(xml) {
  const out = [];
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) || xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
  for (const b of blocks) {
    out.push({
      title: tag(b,'title'),
      link: tag(b,'link') || attr(b,'link','href'),
      description: tag(b,'description') || tag(b,'summary') || tag(b,'content'),
      pubDate: tag(b,'pubDate') || tag(b,'updated') || tag(b,'published'),
    });
  }
  return out;
}
function tag(s, name){ const m = s.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i')); return m?m[1]:''; }
function attr(s,node,a){ const m = s.match(new RegExp(`<${node}[^>]*${a}=["']([^"']+)["'][^>]*>`, 'i')); return m?m[1]:''; }
function matchScore(t, kw){ t=(t||'').toLowerCase(); if(!t)return 0; if(t.includes(kw)) return 1; const ws=kw.split(/\s+/).filter(Boolean); let h=0; ws.forEach(w=>{ if(t.includes(w))h++; }); return Math.min(0.9, h/Math.max(1,ws.length)); }
function recencyBoost(ts){ if(!ts) return 0; const d=(Date.now()-ts)/86400000; if(d<1) return 0.6; if(d<3) return 0.45; if(d<7) return 0.25; if(d<14) return 0.1; return 0; }
function dedupe(arr){ const seen=new Set(); const out=[]; for(const x of arr){ const k=(x.url||'').split('?')[0]; if(seen.has(k)) continue; seen.add(k); out.push(x); } return out; }
