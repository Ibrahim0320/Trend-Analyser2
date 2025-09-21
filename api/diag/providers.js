// api/diag/providers.js
export const config = { runtime: 'nodejs' };

import { fetchYouTubeSignals } from '../../lib/providers/youtube.js';
import { fetchGdeltSignals } from '../../lib/providers/gdelt.js';
import { fetchTrendsSignals } from '../../lib/providers/trends.js';

const safe = async (p) => { try { return await p; } catch (e) { return { __err: String(e?.stack || e) }; } };

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const q = url.searchParams.get('q') || 'trench coat';

  const yt = await safe(fetchYouTubeSignals({ apiKey: process.env.YOUTUBE_API_KEY, query: q }));
  const gd = await safe(fetchGdeltSignals({ query: q }));
  const tr = await safe(fetchTrendsSignals({ query: q }));

  res.status(200).json({
    ok: true,
    query: q,
    youtube: Array.isArray(yt) ? { count: yt.length } : { error: yt?.__err || 'unknown' },
    gdelt: Array.isArray(gd) ? { count: gd.length } : { error: gd?.__err || 'unknown' },
    trends: Array.isArray(tr) ? { count: tr.length } : { error: tr?.__err || 'unknown' },
  });
}
