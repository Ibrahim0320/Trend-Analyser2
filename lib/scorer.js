// lib/scorer.js
// Deterministic scoring & quick aggregates used by /api/research/run

export function scoreOne(s) {
  const viewsTerm = Math.log10((s.views ?? 0) + 1); // 0..~6
  const engage    = Number(s.engagement ?? 0);      // 0..1
  const auth      = Number(s.authority ?? 0);       // 0..1
  const vel       = Number(s.velocity ?? 0);        // 0..1
  const newsRank  = Number(s.newsRank ?? 0);        // 0..1

  // Robust if some fields are missing
  const score =
    0.40 * engage +
    0.25 * auth +
    0.15 * vel +
    0.10 * newsRank +
    0.10 * viewsTerm / 6; // normalize 0..1 range for viewsTerm

  return Number(score.toFixed(4));
}

/**
 * Aggregates for a single entity’s top rows.
 * Returns:
 *  - avgScore (0..1)
 *  - heat (0..100) ~ avgScore*100 (matches your table’s “29, 28” style)
 *  - momentum (simple Δ vs median; placeholder 0 when single run)
 *  - forecast (reuse avgScore as a stable proxy for now)
 *  - confidence (coverage proxy based on #rows)
 */
export function summarizeEntity(rows) {
  if (!rows?.length) {
    return { avgScore: 0, heat: 0, momentum: 0, forecast: 0, confidence: 0 };
  }
  const top = rows.slice(0, 5);
  const avgScore = top.reduce((n, r) => n + (r.score || 0), 0) / top.length;
  const heat = Math.round(avgScore * 100);
  // Momentum & forecast placeholders (can be replaced with historical deltas later)
  const momentum = 0;
  const forecast = Number(avgScore.toFixed(3));
  const confidence = Math.min(1, top.length / 5);
  return { avgScore, heat, momentum, forecast, confidence };
}
