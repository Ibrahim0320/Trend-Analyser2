// lib/providers/index.js
import { fetchSignals as yt } from './youtube.js';
import { fetchSignals as trends } from './trends.js';
import { fetchSignals as gdelt } from './news.js';       // your existing GDELT adapter
import { fetchSignals as reddit } from './reddit.js';
import { fetchSignals as instagram } from './instagram.js';
import { fetchSignals as tiktok } from './tiktok.js';

export async function gatherAllProviders({ region, keywords, limit = 30, since = 21 }) {
  // Run in parallel with soft-fail
  const tasks = [
    yt({ region, keywords, limit, since }),
    trends({ region, keywords, limit, since }),
    gdelt({ region, keywords, limit, since }),
    reddit({ region, keywords, limit, since }),
    instagram({ region, keywords, limit, since }),
    tiktok({ region, keywords, limit, since }),
  ].map(p => p.catch(() => []));
  const results = await Promise.all(tasks);
  return results.flat();
}
