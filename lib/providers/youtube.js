// lib/providers/youtube.js
import { prisma } from '../db.js';
import { PROVIDERS } from './config.js';

export async function fetchYouTubeSignals({ apiKey, query, regionCode = 'US', max = 25 }) {
  if (!apiKey || !query) return [];

  // Lazy-load googleapis so a missing dep can't crash the route
  let google;
  try {
    ({ google } = await import('googleapis'));
  } catch (e) {
    console.error('[youtube] googleapis import failed:', e?.message || e);
    return [];
  }

  let yt;
  try {
    yt = google.youtube({ version: 'v3', auth: apiKey });
  } catch (e) {
    console.error('[youtube] client init failed:', e?.message || e);
    return [];
  }

  // Search
  let search;
  try {
    search = await yt.search.list({
      part: ['id', 'snippet'],
      q: query,
      type: ['video'],
      maxResults: Math.min(max, 50),
      regionCode
    });
  } catch (e) {
    console.error('[youtube] search.list failed:', e?.message || e);
    return [];
  }

  const ids = (search?.data?.items || [])
    .map((it) => it?.id?.videoId)
    .filter(Boolean);
  if (!ids.length) return [];

  // Videos details
  let videos;
  try {
    videos = await yt.videos.list({
      part: ['statistics', 'snippet'],
      id: ids
    });
  } catch (e) {
    console.error('[youtube] videos.list failed:', e?.message || e);
    return [];
  }

  const cfg = PROVIDERS.youtube || {};
  const out = [];
  const now = new Date();

  for (const v of videos?.data?.items || []) {
    const s = v?.statistics || {};
    const views = Number(s.viewCount || 0);
    const likes = Number(s.likeCount || 0);
    const comments = Number(s.commentCount || 0);
    const engagement = views ? (likes + comments) / views : 0;
    const engScaled = engagement * (cfg.engagementScale || 1);

    // best-effort persist; ignore write errors
    try {
      await prisma.video.upsert({
        where: { ytId: v.id },
        update: { seenAt: now },
        create: {
          ytId: v.id,
          title: v?.snippet?.title || null,
          channel: v?.snippet?.channelTitle || null,
          seenAt: now
        }
      });
    } catch {}

    out.push({
      provider: 'youtube',
      sourceId: v.id,
      views,
      likes,
      comments,
      engagement: engScaled,
      authority: 0.6,
      observedAt: now
    });
  }

  return out;
}
