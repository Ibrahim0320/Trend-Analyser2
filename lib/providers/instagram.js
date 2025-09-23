// lib/providers/instagram.js
// Requires a Facebook App + IG Business/Creator account.
// We only fetch media counts (no scraping).

import fetch from 'node-fetch';
import { gates, norm, scoreOf } from '../quality.js';

const { IG_GRAPH_TOKEN, IG_BUSINESS_ID } = process.env;
// Minimal media fields for reels/posts engagement.
const FIELDS = 'caption,like_count,comments_count,media_type,media_url,permalink,timestamp';

export async function fetchSignals({ region, keywords, limit = 30, since = 21 }) {
  if (!IG_GRAPH_TOKEN || !IG_BUSINESS_ID) return [];
  // Search is limited; pragmatic approach: read recent media and keyword-match captions/hashtags.
  const resp = await fetch(`https://graph.facebook.com/v20.0/${IG_BUSINESS_ID}/media?fields=${FIELDS}&limit=${limit}&access_token=${IG_GRAPH_TOKEN}`);
  if (!resp.ok) return [];
  const j = await resp.json();

  const now = Date.now();
  const out = [];
  for (const m of j.data ?? []) {
    const caption = (m.caption ?? '').toLowerCase();
    const match = keywords.find(k => caption.includes(k.toLowerCase()));
    if (!match) continue;

    const ageDays = (now - new Date(m.timestamp).getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays > since) continue;

    const metrics = {
      likes: m.like_count ?? 0,
      comments: m.comments_count ?? 0,
      reach: undefined, // available via insights scope; leave undefined if not granted
      ageDays,
      followers: undefined, // need another call to /{id}?fields=followers_count (for creators)
    };
    if (!gates.instagram(metrics)) continue;

    const s = {
      provider: 'instagram',
      entity: match,
      title: m.caption?.slice(0, 140) ?? '',
      url: m.permalink,
      observedAt: new Date().toISOString(),
      region,
      lang: 'en',
      metrics,
      tags: [],
      provenance: { id: m.id, mediaType: m.media_type, timestamp: m.timestamp },
    };

    const v = norm.instagram(metrics);
    s.score = scoreOf(v);
    out.push(s);
  }
  return out;
}
