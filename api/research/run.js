// api/research/run.js
import { prisma } from '../../lib/db.js';
import { fetchYouTubeSignals } from '../../lib/providers/youtube.js';
import { fetchGdeltSignals } from '../../lib/providers/gdelt.js';
import { fetchTrendsSignals } from '../../lib/providers/trends.js';
import { scoreSignal, confidenceFromMix } from '../../lib/providers/score.js';

export const config = { runtime: 'nodejs' };

async function collectSignals({ region, keywords }) {
  const all = [];
  for (const kwRaw of keywords) {
    const kw = kwRaw.trim();
    if (!kw) continue;

    const [yt, news, tr] = await Promise.all([
      fetchYouTubeSignals({ apiKey: process.env.YOUTUBE_API_KEY, query: kw }),
      fetchGdeltSignals({ query: kw }),
      fetchTrendsSignals({ query: kw })
    ]);

    const merged = [
      ...yt.map(s => ({ ...s, entity: kw, entityType: 'item', region })),
      ...news.map(s => ({ ...s, entity: kw, entityType: 'topic', region })),
      ...tr.map(s => ({ ...s, entity: kw, entityType: 'topic', region })),
    ];

    // score + persist
    for (const s of merged) {
      const hoursAgo = 0;
      const sc = scoreSignal(s.provider, s, hoursAgo);
      s.score = sc;

      await prisma.signal.create({
        data: {
          region: s.region, entity: s.entity, entityType: s.entityType,
          provider: s.provider, sourceId: s.sourceId || null,
          views: s.views, likes: s.likes, comments: s.comments, shares: s.shares,
          searchVol: s.searchVol, newsRank: s.newsRank,
          engagement: s.engagement, velocity: s.velocity, authority: s.authority,
          score: sc, observedAt: s.observedAt || new Date()
        }
      });

      all.push(s);
    }
  }
  return all;
}

async function aggregate({ region, signals }) {
  // group by entity
  const byEntity = new Map();
  for (const s of signals) {
    const key = `${region}::${s.entity.toLowerCase()}`;
    if (!byEntity.has(key)) byEntity.set(key, []);
    byEntity.get(key).push(s);
  }

  const leaders = [];
  const risingBullets = [];
  const citations = [];
  const now = new Date();

  for (const [key, arr] of byEntity.entries()) {
    const entity = key.split('::')[1];

    const totalScore = arr.reduce((a,b)=>a+(b.score||0),0);
    const volume = arr.reduce((a,b)=>a+(b.views||b.searchVol||0),0);
    const mix = arr.map(x=>({provider:x.provider, score:x.score||0}));
    const conf = confidenceFromMix(mix);

    // pick best doc link(s)
    const withDocs = arr.filter(x=>x.sourceId);
    const topDocs = withDocs
      .sort((a,b)=>(b.score||0)-(a.score||0))
      .slice(0,3);

    const urls = [];
    for (const d of topDocs) {
      const doc = await prisma.sourceDoc.findUnique({ where: { id: d.sourceId } });
      if (doc?.url) {
        urls.push(doc.url);
        citations.push({ entity, url: doc.url, provider: d.provider });
      }
    }

    leaders.push({
      entity,
      type: arr[0]?.entityType || 'item',
      trend: Math.min(999, Math.round((totalScore/10)*100))/100, // % style
      volume,
      score: Number(totalScore.toFixed(2)),
      urls
    });

    risingBullets.push(`• ${entity} – ${arr[0]?.entityType || 'item'} (trend ${Math.round((totalScore||0))}%, vol ${Math.round(volume/100)/10}k)`);
  }

  leaders.sort((a,b)=>(b.score||0)-(a.score||0));
  risingBullets.sort();

  // Themes snapshot (Top Movers) based on last 48h signals per entity
  const themes = leaders.slice(0, 10).map(l => ({
    region,
    theme: l.entity,
    heat: Math.min(100, Math.round(l.score)), // normalize 0..100
    momentum: l.score > 50 ? 1 : -1,
    forecast_heat: Math.min(100, Math.round(l.score*1.2)),
    confidence: 0.5,
    act_watch_avoid: l.score > 60 ? 'ACT' : 'WATCH',
    links: l.urls
  }));

  // persist themes
  await prisma.$transaction(themes.map(t => prisma.theme.create({ data: t })));

  return { leaders, risingBullets, citations, sourceCounts: summarizeSources(signals) };
}

function summarizeSources(signals) {
  const counts = { youtube:0, gdelt:0, trends:0 };
  for (const s of signals) {
    if (counts[s.provider] !== undefined) counts[s.provider]++;
  }
  return { trends: counts.trends, youtube: counts.youtube, gdelt: counts.gdelt, reddit: 0 };
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') { res.status(405).json({ ok:false, error:'Method not allowed' }); return; }

    const { region = 'All', keywords = [] } = req.body || {};
    if (!Array.isArray(keywords) || !keywords.length) {
      res.status(200).json({ ok:true, data:{
        leaders: [], rising: [], citations: [], whyMatters: 'No keywords provided.', aheadOfCurve: []
      }});
      return;
    }

    const signals = await collectSignals({ region, keywords });
    const agg = await aggregate({ region, signals });

    const data = {
      leaders: agg.leaders.map(l => ({
        entity: l.entity, type: l.type, trend: l.trend*100, volume: l.volume, score: l.score, urls: l.urls
      })),
      rising: agg.risingBullets,
      citations: agg.citations,
      whyMatters: 'External signals show momentum across search, video, and news. Links below.',
      aheadOfCurve: [
        'Prototype top-2 items with creators; measure saves/comments lift vs baseline.',
        'Test color accents on winners before scaling.',
        'Alert: if 2+ reputable sources publish within 7d for a keyword, bump priority.'
      ],
      sourceCounts: agg.sourceCounts
    };

    res.status(200).json({ ok:true, data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error:'Server error' });
  }
}
