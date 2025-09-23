// lib/quality.js
// Normalization + scoring used by all providers

export const clamp01 = (x) => Math.max(0, Math.min(1, x));

export function zLog(n, denom = 7) {
  if (!n || n <= 0) return 0;
  return clamp01(Math.log10(n) / denom);
}

export function recencyBonus(ageDays, halfLifeDays = 7) {
  if (ageDays == null) return 0.5;
  return clamp01(Math.exp(-ageDays / halfLifeDays));
}

export function likeRate(likes, views) {
  if (!views) return 0;
  return likes / views;
}

// --- Per-provider normalization -> {eng, vel, auth} in 0..1
export const norm = {
  youtube: (m) => {
    const lr = likeRate(m.likes, m.views);
    return {
      eng: clamp01(zLog(m.views) * 0.6 + lr * 0.4),
      vel: clamp01(((m.views ?? 0) / Math.max(1, (m.ageDays ?? 1) ** 1.2)) / 1e6), // cohort-normalized-ish
      auth: clamp01((m.subs ?? 0) / 2_000_000),
    };
  },
  reddit: (m) => ({
    eng: clamp01(zLog(m.upvotes) * 0.6 + zLog(m.comments) * 0.4),
    vel: recencyBonus(m.ageDays, 4),
    auth: clamp01((m.subredditRank ?? 50) / 100), // fallback 0.5
  }),
  instagram: (m) => {
    const lr = likeRate(m.likes, m.views || m.reach || 0);
    return {
      eng: clamp01(zLog(m.views || m.reach || m.likes) * 0.6 + lr * 0.4),
      vel: recencyBonus(m.ageDays, 3),
      auth: clamp01((m.followers ?? 0) / 5_000_000),
    };
  },
  tiktok: (m) => {
    const lr = likeRate(m.likes, m.views);
    return {
      eng: clamp01(zLog(m.views) * 0.6 + lr * 0.4),
      vel: recencyBonus(m.ageDays, 3),
      auth: clamp01((m.followers ?? 0) / 5_000_000),
    };
  },
  trends: (m) => ({ eng: clamp01(m.rank ?? 0), vel: clamp01(m.rankDelta7d ?? 0), auth: 0.6 }),
  gdelt:  (m) => ({ eng: clamp01((m.domainRank ?? 60) / 100), vel: recencyBonus(m.ageDays, 7), auth: clamp01((m.domainWeight ?? 0.6) * (m.domainRank ?? 60) / 100) }),
};

// Unified score (same for all)
export function scoreOf({ eng, vel, auth }) {
  let score = 0.45 * eng + 0.30 * vel + 0.25 * auth;
  return clamp01(score);
}

// Hard gates per provider (minimum quality)
export const gates = {
  youtube: (m) => (m.views >= 50_000 && m.likes >= 500 && likeRate(m.likes, m.views) >= 0.01) ||
                  (m.views >= 10_000 && (m.viewGrowth7d ?? 0) >= 0.6 && likeRate(m.likes, m.views) >= 0.02),
  reddit: (m) => (m.upvotes >= 200 && m.comments >= 20) || (m.upvotes >= 50 && recencyBonus(m.ageDays, 2) > 0.6),
  instagram: (m) => (m.likes >= 1000 || (m.views ?? 0) >= 20_000),
  tiktok: (m) => (m.views >= 20_000 && likeRate(m.likes, m.views) >= 0.02),
  trends: (m) => (m.rank >= 0.25) || ((m.rankDelta7d ?? 0) >= 0.12),
  gdelt:  (m) => (m.domainRank ?? 0) >= 60 && (m.domainWeight ?? 0.6) >= 0.6,
};
