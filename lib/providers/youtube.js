// lib/providers/youtube.js
import { google } from 'googleapis';
import { prisma } from '../db.js';
import { PROVIDERS } from './config.js';

export async function fetchYouTubeSignals({ apiKey, query, regionCode = 'US', max = 25 }) {
  if (!apiKey) return [];
  const cfg = PROVIDERS.youtube;
  const yt = google.youtube({ version: 'v3', auth: apiKey });

  let search;
  try {
    search = await yt.search.list({
      part: ['id', 'snippet'],
      q: query,
      type: ['video'],
      maxResults: Math.min(max, 50),
      regionCode
    });
  } catch {
    return [];
  }

  const ids = (search?.data?.items || [])
    .map((it) => it?.id?.videoId)
    .filter(Boolean);

  if (!ids.length) return [];

  let videos;
  try {
    videos = await yt.videos.list({
      part: ['statistics', 'snippet'],
      id: ids
    });
  } catch {
    return [];
  }

  const out = [];
  const now = new Date();

  for (const v of videos?.data?.items || []) {
    const s = v?.statistics || {};
    const views = Number(s.viewCount || 0);
    const likes = Number(s.likeCount || 0);
    const comments = Number(s.commentCount || 0);
    const eng = (views ? (likes + comments) / views : 0) * (cfg.engagementScale || 1);

    // best-effort persist the video so we can link back
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
    } catch {
      // ignore write errors; keep going
    }

    out.push({
      provider: 'youtube',
      sourceId: v.id,
      views,
      likes,
      comments,
      engagement: eng,
      authority: 0.6, // could be channel-subs lookup
      observedAt: now
    });
  }

  return out;
}
