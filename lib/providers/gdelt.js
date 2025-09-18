// lib/providers/gdelt.js
import { prisma } from '../db.js';
import { PROVIDERS } from './config.js';

const FASHION_SITES = (process.env.EDITORIAL_ALLOWLIST || 'vogue.com,harpersbazaar.com,wwd.com,thecut.com,elle.com,businessoffashion.com')
  .split(',').map(s => s.trim()).filter(Boolean);

function isAllowed(url) {
  try { return FASHION_SITES.some(domain => new URL(url).hostname.endsWith(domain)); }
  catch { return false; }
}

export async function fetchGdeltSignals({ query, max = 30 }) {
  // GDELT 2.1 Web API: Recent articles for a query (simple CSV/JSON endpoint)
  // We'll use the 2.1 "gkg" search via json format.
  const hoursBack = 7 * 24;
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=ArtList&maxrecords=${Math.min(max, 75)}&format=json&timespan=${hoursBack}h`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const j = await res.json();
  const arts = j?.articles || [];
  const now = new Date();

  const out = [];
  for (const a of arts) {
    const link = a.url || a.sourceurl;
    if (!link) continue;
    if (!isAllowed(link)) continue;

    const publishedAt = a?.seendate ? new Date(a.seendate.slice(0,4)+'-'+a.seendate.slice(4,6)+'-'+a.seendate.slice(6,8)) : null;

    const doc = await prisma.sourceDoc.upsert({
      where: { url: link },
      update: { title: a.title || null, author: a.source || null, publishedAt, country: a.sourcelang || null },
      create: {
        provider: 'gdelt',
        url: link,
        title: a.title || null,
        author: a.source || null,
        publishedAt,
        lang: a.lang || null,
        country: a.sourcelang || null
      }
    });

    // newsRank: rough proxy (GDELT doesn't give "views"); use 1.0 baseline
    out.push({
      provider: 'gdelt',
      sourceId: doc.id,
      newsRank: 1.0,
      authority: 0.9,
      engagement: 0,
      observedAt: now
    });
  }
  return out;
}
