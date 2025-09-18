// lib/providers/trends.js
import trends from 'google-trends-api';

export async function fetchTrendsSignals({ query, geo = 'US' }) {
  try {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - (7*24*60*60*1000));
    const results = await trends.interestOverTime({
      keyword: query,
      startTime,
      endTime,
      geo
    });
    const data = JSON.parse(results);
    const points = data?.default?.timelineData || [];
    if (!points.length) return [];
    const last = points[points.length - 1];
    const searchVol = Number(last?.value?.[0] || 0);
    return [{
      provider: 'trends',
      searchVol,
      engagement: 0,
      authority: 0.8,
      observedAt: new Date()
    }];
  } catch {
    return [];
  }
}
