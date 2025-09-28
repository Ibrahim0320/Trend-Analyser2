// lib/providers/reddit.js
import fetch from 'node-fetch';
import { PROVIDER_RULES } from './config.js';

const R = PROVIDER_RULES.reddit;

/** tiny helper */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function withRetry(fn, { tries = 2, delay = 400 } = {}) {
  let lastErr;
  for (let i = 0; i <= tries; i++) {
    try { return await fn(); } catch (e) { lastErr = e; if (i < tries) await sleep(delay * (i + 1)); }
  }
  throw lastErr;
}

function withTimeout(p, ms = 7000) {
  return Promise.race([
    p,
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
  ]);
}

/**
 * Normalize a Reddit Listing item -> Signal shape used by your app.
 */
function mapRedditItem(it, entity, region) {
  const d = it?.data || {};
  const permalink = d.permalink ? `https://www.reddit.com${d.permalink}` : null;

  // Treat score as “likes”, upvote_ratio informs a bit of quality, comments as comments.
  const likes = Number(d.score ?? 0);
  const comments = Number(d.num_comments ?? 0);

  return {
    region,
    entity,
    entityType: 'theme',
    provider: 'reddit',
    sourceId: d.id || null,
    title: d.title || entity,
    url: permalink,
    views: 0, // Reddit does not expose views publicly
    likes,
    comments,
    shares: 0,
    // use recentness + engagement as rough proxy for velocity
    observedAt: d.created_utc ? new Date(d.created_utc * 1000).toISOString() : new Date().toISOString(),

    // scoring hints (the rollup will re-derive eng/vel/auth; we still provide hints)
    score: undefined, // let server compute
    rank: d.ups ?? likes,
  };
}

/**
 * Fetch signals for a single entity. We search a configurable set of subs plus global.
 */
async function fetchEntity({ entity, region, limit = 10, subs = [] }) {
  const q = encodeURIComponent(entity);
  const endpoints = [
    // global
    `https://www.reddit.com/search.json?q=${q}&sort=hot&t=week&limit=${Math.min(limit, 20)}`,
    // per-subreddit searches
    ...subs.map(s => `https://www.reddit.com/r/${encodeURIComponent(s)}/search.json?q=${q}&restrict_sr=1&sort=hot&t=week&limit=${Math.min(limit, 20)}`),
  ];

  const pages = await Promise.allSettled(
    endpoints.map(url =>
      withRetry(() => withTimeout(fetch(url, { headers: { 'user-agent': 'trend-analyser-bot/1.0' } }), 7000)
        .then(r => {
          if (!r.ok) throw new Error(`reddit ${r.status}`);
          return r.json();
        })
      )
    )
  );

  const items = [];
  for (const p of pages) {
    if (p.status !== 'fulfilled') continue;
    const arr = p.value?.data?.children ?? [];
    for (const it of arr) items.push(mapRedditItem(it, entity, region));
  }
  return items;
}

/**
 * Public: fetch normalized Reddit signals for a keyword list.
 */
export async function fetchRedditSignals({ keywords, region, limit = 10 }) {
  if (!Array.isArray(keywords) || !keywords.length) return [];

  const subs = (process.env.REDDIT_SUBS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  // fan-out per keyword
  const results = await Promise.allSettled(
    keywords.map(k => fetchEntity({ entity: k, region, limit, subs }))
  );

  // flatten + quality filter
  const flat = [];
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    for (const s of r.value) {
      const pass =
        (s.likes ?? 0) >= R.minScore ||
        (s.comments ?? 0) >= R.minComments;
      if (pass) flat.push(s);
    }
  }
  return flat;
}
