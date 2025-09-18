// lib/providers/config.js
export const PROVIDERS = {
  youtube:  { baseWeight: 1.0, credibility: 0.75, minViews: 10000, minEngRate: 0.01,  minAccountFoll: 5000,  halfLifeHrs: 96 },
  gdelt:    { baseWeight: 1.4, credibility: 0.95, minViews: 0,     minEngRate: 0,     minAccountFoll: 0,     halfLifeHrs: 168 },
  trends:   { baseWeight: 1.2, credibility: 0.90, minViews: 0,     minEngRate: 0,     minAccountFoll: 0,     halfLifeHrs: 168 },
};
