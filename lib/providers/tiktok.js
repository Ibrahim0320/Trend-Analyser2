// lib/providers/tiktok.js
// Uses TikTok Business (Marketing) API if creds exist; otherwise returns [].

import fetch from 'node-fetch';
import { gates, norm, scoreOf } from '../quality.js';

const { TIKTOK_ACCESS_TOKEN, TIKTOK_BUSINESS_ID } = process.env;

export async function fetchSignals({ region, keywords, limit = 30, since = 21 }) {
  if (!TIKTOK_ACCESS_TOKEN || !TIKTOK_BUSINESS_ID) return [];

  // Placeholder: fetch recent videos for an owned/authorized account, then keyword-match caption.
  // Docs differ by account type; keep this minimal and safe:
  const resp = await fetch(`https://business-api.tiktok.com/open_api/v1.3/video/list/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Access-Token': TIKTOK_ACCESS_TOKEN },
    body: JSON.stringify({ advertiser_id: TIKTOK_BUSINESS_ID, page_size: limit }),
  });
  if (!resp.ok) return [];
  const j = await resp.json();
  const list = j?.data?.list ?? [];

  const now = Date.now();
  const out = [];
  for (const v of list) {
    const caption = (v.caption || '').toLowerCase();
    const match = keywords.find(k => caption.includes(k.toLowerCase()));
    if (!match) continue;

    const ageDays = (now - (new Date(v.create_time).getTime())) / (1000 * 60 * 60 * 24);
    if (ageDays > since) continue;

    const metrics = {
      views: v.stats?.play ?? 0,
      likes: v.stats?.like ?? 0,
      comments: v.stats?.comment ?? 0,
      shares: v.stats?.share ?? 0,
      followers: v.author_stats?.follower_count ?? 0,
      ageDays,
    };
    if (!gates.tiktok(metrics)) continue;

    const s = {
      provider: 'tiktok',
      entity: match,
      title: caption.slice(0, 140),
      url: v.share_url || v.video_url || '',
      observedAt: new Date().toISOString(),
      region,
      lang: 'en',
      metrics,
      tags: [],
      provenance: { id: v.video_id, authorId: v.author_id, createdAt: v.create_time },
    };

    const vnorm = norm.tiktok(metrics);
    s.score = scoreOf(vnorm);
    out.push(s);
  }
  return out;
}
