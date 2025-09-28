// lib/providers/config.js
export const PROVIDER_RULES = {
  youtube:   { minLikes: 500,  minViews: 30_000, weight: 1.0 },
  reddit:    { minScore: 50,   minComments: 10,   weight: 0.9 },
  news:      { minRank: 30,                     weight: 0.8 },
  trends:    { minVol: 25,                      weight: 0.7 },
  // placeholders (future)
  tiktok:    { minLikes: 1000, minViews: 50_000, weight: 1.1 },
  instagram: { minLikes: 800,  minViews: 40_000, weight: 1.0 },
};
