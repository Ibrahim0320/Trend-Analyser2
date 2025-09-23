// lib/providers/reddit.js
// Official Reddit API via OAuth2 (script app). No scraping.

import fetch from 'node-fetch';
import { gates, norm, scoreOf } from '../quality.js';

const { REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USER, REDDIT_PASS } = process.env;

async function getToken() {
  if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET || !REDDIT_USER || !REDDIT_PASS) return null;
  const resp = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`).toString('base64'),
    },
    body: new URLSearchParams({ grant_type: 'password', username: REDDIT_USER, password: REDDIT_PASS }),
  });
  if (!resp.ok) return null;
  const j = await resp.json();
  return j.access_token;
}

export async function fetchSignals({ region, keywords, limit = 30, since = 21 }) {
  const token = await getToken();
  if (!token) return [];

  const qs = new URLSearchParams({ q: keywords.join(' OR '), sort: 'new', limit: String(limit) });
  const resp = await fetch(`https://oauth.reddit.com/search?${qs}`, {
    headers: { Authorization: `bearer ${token}`, 'User-Agent': 'trend-analyser/1.0' },
  });
  if (!resp.ok) return [];
  const j = await resp.json();

  const now = Date.now();
  const out = [];
  for (const item of j.data.children ?? []) {
    const p = item.data;
    const ageDays = (now - (p.created_utc * 1000)) / (1000 * 60 * 60 * 24);
    if (ageDays > since) continue;

    const m = {
      upvotes: p.ups ?? 0,
      comments: p.num_comments ?? 0,
      ageDays,
      subredditRank: 70, // TODO: optional lookup (pushshift/mod stats) – fallback mid
    };
    if (!gates.reddit(m)) continue;

    const s = {
      provider: 'reddit',
      entity: keywords.find(k => (p.title?.toLowerCase()?.includes(k.toLowerCase()))) ?? keywords[0],
      title: p.title,
      url: `https://www.reddit.com${p.permalink}`,
      observedAt: new Date().toISOString(),
      region,
      lang: 'en', // Reddit doesn’t expose language reliably
      metrics: { ...m },
      tags: p.link_flair_text ? [p.link_flair_text] : [],
      provenance: { id: p.id, subreddit: p.subreddit, author: p.author, createdUtc: p.created_utc },
    };

    const v = norm.reddit(m);
    s.score = scoreOf(v);
    out.push(s);
  }
  return out;
}
