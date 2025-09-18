// lib/providers/score.js
import { PROVIDERS } from './config.js';

export function scoreSignal(providerKey, s, hoursAgo = 0) {
  const p = PROVIDERS[providerKey] || { baseWeight:1, credibility:0.7, halfLifeHrs:96 };
  const freshness = Math.pow(0.5, hoursAgo / (p.halfLifeHrs || 96));
  const engagement = s.engagement || 0;
  const authority = s.authority ?? 0.5;
  const volume = (s.views || s.searchVol || 0);

  const raw = (Math.log10(1 + volume) * 0.5) + (engagement * 20) + (authority * 10);
  return raw * p.baseWeight * p.credibility * freshness;
}

export function confidenceFromMix(mix) {
  const byProvider = mix.reduce((m, x) => (m[x.provider]=(m[x.provider]||0)+x.score, m), {});
  const providersHit = Object.keys(byProvider).length;
  const total = mix.reduce((a,b)=>a+b.score,0);
  const spreadBonus = Math.min(1, providersHit / 4) * 0.3;
  const base = Math.min(1, total / 100);
  return Math.max(0, Math.min(1, base + spreadBonus));
}
