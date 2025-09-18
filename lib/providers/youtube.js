// lib/providers/youtube.js
import { google } from 'googleapis';
import { prisma } from '../db.js';
import { PROVIDERS } from './config.js';

export async function fetchYouTubeSignals({ apiKey, query, regionCode = 'US', max = 25 }) {
  if (!apiKey) return [];
  const cfg = PROVIDERS.youtube;
  const yt = google.youtube({ version: 'v3', auth: apiKey });

  const search = await yt.search.list({
    part: ['id','snippet'],
    q: query,
    type: ['video'],
    maxResults: Math.min(max, 50),
    regionCode
  });

  const ids = (search.data.items || [])
    .map(i => i.id?.videoId)
    .filter(Boolean);

  if (!ids.length) return [];

  const videos = await yt.videos.list({ part: ['statistics','snippet'], id: ids });
  const now = new Date();

  const out = [];
  for (const v of (videos.data.items || [])) {
    const stats = v.statistics || {};
    const views = Number(stats.viewCount || 0);
    const likes = Number(stats.likeCount || 0);
    const comments = Number(stats.commentCount || 0);
    const eng = views > 0 ? (likes + comments) / views : 0;

    // gates
    if (views < cfg.minViews) continue;
    if (eng < cfg.minEngRate) continue;

    const url = `https://www.youtube.com/watch?v=${v.id}`;
    const publishedAt = v.snippet?.publishedAt ? new Date(v.snippet.publishedAt) : null;

    const doc = await prisma.sourceDoc.upsert({
      where: { url },
      update: { title: v.snippet?.title || null, author: v.snippet?.channelTitle || null, views, likes, comments, publishedAt },
      create: {
        provider: 'youtube',
        url,
        title: v.snippet?.title || null,
        author: v.snippet?.channelTitle || null,
        views, likes, comments, publishedAt,
        lang: v.snippet?.defaultAudioLanguage || null
      }
    });

    out.push({
      provider: 'youtube',
      sourceId: doc.id,
      views, likes, comments,
      engagement: eng,
      authority: 0.6, // could be channel-subs lookup
      observedAt: now
    });
  }
  return out;
}
