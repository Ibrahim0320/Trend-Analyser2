// api/ingest/news.js
// Fetch RSS from reputable fashion sources and return best-matching links
// per keyword. No external deps.

export const config = { runtime: 'nodejs' };

import { FASHION_FEEDS, normalizeText } from '../../lib/fashionSources.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { keywords = [], limitPerKeyword = 3 } = req.body || {};
    const keys = (Array.isArray(keywords) ? keywords : []).map(k => String(k).toLowerCase().trim()).filter(Boolean);

    if (!keys.length) return res.status(200).json({ citations: [], count: 0 });

    const feedXMLs = await fetchAll(FASHION_FEEDS.map(f => f.rss));

    // Parse items
    const items = [];
    for (let i = 0; i < feedXMLs.length; i++) {
      const xml = feedXMLs[i];
      if (!xml) continue;
      const parsed = parseRSS(xml);
      for (const it of parsed) {
        items.push({
          source: FASHION_FEEDS[i].name,
          weight: FASHION_FEEDS[i].weight,
          title: normalizeText(it.title),
          summary: normalizeText(it.description || it.content || ''),
          link: it.link,
          pub: it.pubDate ? new Date(it.pubDate).getTime() : 0
        });
      }
    }

    // Score by keyword match + recency + source weight
    const out = [];
    for (const kw of keys) {
      const scored = items
        .map(it => ({
          it,
          score:
            scoreText(it.title, kw) * 1.2 +
            scoreText(it.summary, kw) * 0.8 +
            recentBoost(it.pub) +
            it.weight * 0.5
        }))
        .filter(s => s.score > 0.6) // keep only meaningful matches
        .sort((a,b) => b.score - a.score)
        .slice(0, limitPerKeyword)
        .map(s => ({ entity: kw, source: s.it.source, url: s.it.link, title: s.it.title }));

      out.push(...scored);
    }

    return res.status(200).json({ citations: dedupeLinks(out), count: out.length });
  } catch (e) {
    console.error('[ingest/news] error', e);
    return res.status(500).json({ error: 'Internal error' });
  }
}

async function fetchAll(urls) {
  return await Promise.all(
    urls.map(async (u) => {
      try {
        const r = await fetch(u, { headers: { 'User-Agent': 'TrendAnalyser/1.0 (+vercel)' } });
        if (!r.ok) return null;
        return await r.text();
      } catch { return null; }
    })
  );
}

// Minimal, dependency-free RSS parser (Atom-ish tolerant)
function parseRSS(xml) {
  if (!xml) return [];
  const items = [];
  const itemRe = /<item[\s\S]*?<\/item>/gi;
  const entryRe = /<entry[\s\S]*?<\/entry>/gi;
  const blocks = xml.match(itemRe) || xml.match(entryRe) || [];
  for (const block of blocks) {
    items.push({
      title: tag(block, 'title'),
      link: tag(block, 'link') || attr(block, 'link', 'href'),
      description: tag(block, 'description') || tag(block, 'summary') || tag(block, 'content'),
      pubDate: tag(block, 'pubDate') || tag(block, 'updated') || tag(block, 'published')
    });
  }
  return items;
}
function tag(s, name) {
  const m = s.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? m[1] : '';
}
function attr(s, node, attrName) {
  const m = s.match(new RegExp(`<${node}[^>]*${attrName}=["']([^"']+)["'][^>]*>`, 'i'));
  return m ? m[1] : '';
}

function scoreText(text, kw) {
  const t = (text || '').toLowerCase();
  if (!t) return 0;
  // exact word, phrase, then fuzzy presence
  if (t.includes(kw)) return 1.0;
  const words = kw.split(/\s+/).filter(Boolean);
  let hit = 0;
  for (const w of words) { if (t.includes(w)) hit++; }
  return Math.min(0.9, hit / Math.max(words.length,1));
}
function recentBoost(ts) {
  if (!ts) return 0;
  const days = (Date.now() - ts) / (1000*60*60*24);
  if (days < 1) return 0.6;
  if (days < 3) return 0.45;
  if (days < 7) return 0.25;
  if (days < 14) return 0.1;
  return 0;
}
function dedupeLinks(arr) {
  const seen = new Set();
  const out = [];
  for (const c of arr) {
    const key = (c.url || '').split('?')[0];
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}
