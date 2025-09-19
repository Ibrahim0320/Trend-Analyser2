// lib/providers/gdelt.js
import { prisma } from '../db.js';
import { PROVIDERS } from './config.js';

const FASHION_SITES = (process.env.EDITORIAL_ALLOWLIST || 'vogue.com,harpersbazaar.com,wwd.com,thecut.com,elle.com,businessoffashion.com')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function isAllowed(url) {
  try {
    return FASHION_SITES.some((domain) => new URL(url).hostname.endsWith(domain));
  } catch {
    return false;
  }
}

export async function fetchGdeltSignals({ query, max = 30 }) {
  const hoursBack = 7 * 24;
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=ArtList&maxrecords=${Math.min(max, 75)}&format=json&timespan=${hoursBack}h`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);

  let res;
  try {
    res = await fetch(url, { signal: ctrl.signal });
  } catch {
    clearTimeout(timer);
    return [];
  }
  clearTimeout(timer);

  if (!res.ok) return [];
  let j;
  try {
    j = await res.json();
  } catch {
    return [];
  }

  const arts = Array.isArray(j?.articles) ? j.articles : [];
  const out = [];
  const now = new Date();

  for (const a of arts) {
    const link = a?.url || a?.sourceurl || '';
    if (!link || !isAllowed(link)) continue;

    try {
      await prisma.article.upsert({
        where: { url: link },
        update: { seenAt: now },
        create: { url: link, seenAt: now, title: a.title || null, source: a?.source || null }
      });
    } catch {
      // ignore persistence errors for GDELT; keep collecting
    }

    out.push({
      provider: 'gdelt',
      sourceId: a?.id || null,
      newsRank: 1.0,       // rough proxy (GDELT has no views)
      authority: 0.9,
      engagement: 0,
      observedAt: now
    });
  }

  return out;
}
