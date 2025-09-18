// lib/fashionSources.js
// Curated, reputable sources with stable RSS feeds (no scraping).
// You can tune weights later to bias citation selection.

export const FASHION_FEEDS = [
  { name: 'Vogue',            rss: 'https://www.vogue.com/rss',                    weight: 1.0 },
  { name: 'Business of Fashion', rss: 'https://www.businessoffashion.com/feed',   weight: 1.0 },
  { name: 'WWD',              rss: 'https://wwd.com/feed/',                        weight: 0.9 },
  { name: 'The Guardian – Fashion', rss: 'https://www.theguardian.com/fashion/rss', weight: 0.9 },
  { name: 'GQ',               rss: 'https://www.gq.com/rss',                       weight: 0.8 },
  { name: 'ELLE',             rss: 'https://www.elle.com/rss/all.xml',             weight: 0.8 },
  { name: 'Harper’s Bazaar',  rss: 'https://www.harpersbazaar.com/rss/all.xml',    weight: 0.8 },
  { name: 'Highsnobiety',     rss: 'https://www.highsnobiety.com/rss',             weight: 0.7 },
  { name: 'Hypebeast',        rss: 'https://hypebeast.com/feed',                   weight: 0.7 },
];

// Simple helpers to enrich/clean text
export function normalizeText(s) {
  return String(s || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
