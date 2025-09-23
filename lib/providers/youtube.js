// lib/providers/youtube.js
import { google } from 'googleapis';

const YT = google.youtube('v3');

function getClient() {
  const key = process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) throw new Error('Missing YOUTUBE_API_KEY (or GOOGLE_API_KEY)');
  return { auth: key };
}

// Turn ISO or Date into ISO string now
const isoNow = () => new Date().toISOString();

export async function fetchYouTubeSignals({ query, region, max = 8 }) {
  const client = getClient();

  // 1) search -> get videoIds
  const search = await YT.search.list({
    ...client,
    part: ['id', 'snippet'],
    q: query,
    type: ['video'],
    maxResults: Math.min(Math.max(3, max), 20),
    regionCode: regionCodeFromLabel(region), // best effort
    order: 'relevance',
  });

  const items = search.data.items || [];
  const videoIds = items.map(i => i.id?.videoId).filter(Boolean);
  if (!videoIds.length) return [];

  // 2) videos -> get stats + channelIds
  const videos = await YT.videos.list({
    ...client,
    part: ['id', 'snippet', 'statistics'],
    id: videoIds,
  });

  const vItems = videos.data.items || [];
  const channelIds = [...new Set(vItems.map(v => v.snippet?.channelId).filter(Boolean))];

  // 3) channels -> get subscriberCount (authority proxy)
  let channelSubs = new Map();
  if (channelIds.length) {
    const channels = await YT.channels.list({
      ...client,
      part: ['statistics'],
      id: channelIds,
      maxResults: channelIds.length,
    });
    for (const c of channels.data.items || []) {
      const cid = c.id;
      const subs = Number(c.statistics?.subscriberCount ?? 0);
      channelSubs.set(cid, subs);
    }
  }

  // 4) Normalize
  const signals = vItems.map(v => {
    const vid = v.id;
    const title = v.snippet?.title || query;
    const url = `https://www.youtube.com/watch?v=${vid}`;
    const views = Number(v.statistics?.viewCount ?? 0);
    // likeCount is often hidden; we fallback to 0
    const likes = Number(v.statistics?.likeCount ?? 0);
    const comments = Number(v.statistics?.commentCount ?? 0);
    const cid = v.snippet?.channelId || '';
    const subs = channelSubs.get(cid) ?? 0;

    return {
      provider: 'youtube',
      entity: query,
      title,
      url,
      sourceId: vid,
      views,
      likes,
      comments,
      channelSubs: subs,
      observedAt: isoNow(),
    };
  });

  // Keep top by views as a simple heuristic (you can change to recency/score)
  signals.sort((a, b) => b.views - a.views);
  return signals.slice(0, max);
}

// Best-effort mapping for your region labels to YouTube’s regionCode
function regionCodeFromLabel(label = '') {
  const L = String(label).toLowerCase();
  if (L.includes('nordic')) return 'SE';
  if (L.includes('uk')) return 'GB';
  if (L.includes('us') || L.includes('usa') || L.includes('america')) return 'US';
  if (L.includes('fr')) return 'FR';
  if (L.includes('de')) return 'DE';
  return 'US';
}
