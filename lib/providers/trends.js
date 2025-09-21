// lib/providers/trends.js
// Fetch Google Trends signals with lazy import so a missing dep can't crash the route.

export async function fetchTrendsSignals({
  query,
  geo = 'US',
  timeframe = 'now 7-d',
  max = 20,
}) {
  if (!query) return [];

  // Lazy-load google-trends-api so import-time failures don't 500 the function
  let gtrends;
  try {
    const mod = await import('google-trends-api');
    gtrends = mod.default || mod; // CJS default export
  } catch (e) {
    console.error('[trends] google-trends-api import failed:', e?.message || e);
    return []; // fail-soft
  }

  // Call interestOverTime and parse
  let json;
  try {
    const raw = await gtrends.interestOverTime({ keyword: query, geo, timeframe });
    json = JSON.parse(raw);
  } catch (e) {
    console.error('[trends] interestOverTime failed:', e?.message || e);
    return [];
  }

  const points = json?.default?.timelineData || [];
  if (!Array.isArray(points) || !points.length) return [];

  // Normalize to your signal shape
  return points.slice(-max).map((p) => {
    const v = Number(Array.isArray(p.value) ? p.value[0] : p.value ?? 0);
    const ts = Number(p.time || 0) * 1000; // p.time is seconds since epoch
    return {
      provider: 'trends',
      sourceId: String(p.time ?? ''), // keep as string id
      searchVol: v,                   // 0..100 scaled by Google
      engagement: v / 100,            // simple normalization
      authority: 0.3,                 // heuristic
      observedAt: isFinite(ts) ? new Date(ts) : new Date(),
    };
  });
}
