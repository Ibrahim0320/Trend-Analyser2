export const config = { runtime: 'nodejs' };

import { PrismaClient } from '@prisma/client';
import { isWhitelisted, SOURCE_WEIGHTS, MIN_SIGNAL_BY_SOURCE } from '../../lib/fashionSources.js';

const prisma = new PrismaClient();

// helper: basic whitelist + platform thresholds
function acceptHit(hit) {
  if (!hit?.url) return false;
  if (!isWhitelisted(hit.url)) return false;

  const host = new URL(hit.url).hostname;
  const h = host.includes('youtube') ? 'youtube'
           : host.includes('tiktok') ? 'tiktok'
           : host.includes('x.com') || host.includes('twitter') ? 'x'
           : 'web';

  const rules = MIN_SIGNAL_BY_SOURCE[h];
  if (h==='youtube' && rules && (hit.views||0) < rules.minViews) return false;
  if (h==='tiktok' && rules && (hit.views||0) < rules.minViews) return false;
  if (h==='x' && rules && ((hit.likes||0)+(hit.retweets||0)+(hit.replies||0)) < rules.minEngagement) return false;

  return true;
}

function weightFor(url) {
  const u = new URL(url).hostname;
  if (u.includes('vogue')) return SOURCE_WEIGHTS.vogue;
  if (u.includes('voguebusiness')) return SOURCE_WEIGHTS.voguebusiness;
  if (u.includes('businessoffashion')) return SOURCE_WEIGHTS.businessoffashion;
  if (u.includes('lyst')) return SOURCE_WEIGHTS.lyst;
  if (u.includes('wgsn')) return SOURCE_WEIGHTS.wgsn;
  if (u.includes('edited')) return SOURCE_WEIGHTS.edited;
  if (/(nytimes|ft|wsj|theguardian)\.com$/.test(u)) return SOURCE_WEIGHTS.tier1_press;
  if (/(youtube|instagram|tiktok|x\.com)$/.test(u)) return SOURCE_WEIGHTS.platform_verified;
  return 0.4;
}

// faux fetchers (replace with your existing adapters or API calls)
async function fetchSignals({ region, keywords }) {
  // should return array of {entity,type,trend,volume,url,meta}
  // Here we assume you already have your adapters wired; we only filter/score below.
  const rows = []; // <- replace with real pull from Trends/GDELT/YouTube/etc.
  return rows.filter(acceptHit).map(r => ({
    ...r,
    score: (r.trend ?? 0) * weightFor(r.url)
  }));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'Use POST' });

  const { region = 'All', keywords = [] } = req.body || {};
  try {
    const hits = await fetchSignals({ region, keywords });

    // aggregate -> leaders
    const map = new Map();
    for (const h of hits) {
      const key = `${h.entity}|${h.type}`;
      const prev = map.get(key) || { entity:h.entity, type:h.type, trend:0, volume:0, score:0, urls:[] };
      prev.trend  = Math.max(prev.trend, h.trend ?? 0);
      prev.volume = prev.volume + (h.volume ?? 0);
      prev.score  = prev.score + (h.score ?? 0);
      if (prev.urls.length < 3) prev.urls.push(h.url);
      map.set(key, prev);
    }
    const leaders = [...map.values()].sort((a,b)=>b.score-a.score).slice(0,12);

    // bullets (What’s rising)
    const rising = leaders.slice(0,6).map(l => `• ${l.entity} – ${l.type} (trend ${Math.round(l.trend*100)}%, vol ${Math.round(l.volume)})`);

    // citations: the best URL per leader
    const citations = leaders.map(l => ({ entity: l.entity, url: l.urls[0] })).filter(c => !!c.url);

    // save a snapshot (optional)
    await prisma.researchRun.create({
      data: {
        region,
        keywords_json: keywords,
        leaders_json: leaders,
        rising_json: rising,
        why_matters: "External signals show momentum across trusted fashion media + platforms.",
        ahead_json: [
          "Prototype looks/content aligned to top themes; track save/comment uplift.",
          "Brief paid + creator partners where momentum is sustained.",
          "Set a watchlist alert when 7d trend > 1.3× across two sources."
        ],
        citations_json: citations
      }
    });

    res.json({
      ok:true,
      data:{
        region,
        rising,
        leaders,
        whyMatters: "External signals show momentum across trusted fashion media + platforms.",
        aheadOfCurve: [
          "Prototype looks/content aligned to top themes; track save/comment uplift.",
          "Brief paid + creator partners where momentum is sustained.",
          "Set a watchlist alert when 7d trend > 1.3× across two sources."
        ],
        citations,
        sourceCounts: { trends: 0, youtube: 0, gdelt: 0, reddit: 0 } // fill from adapters
      }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error:'research-failed' });
  }
}
