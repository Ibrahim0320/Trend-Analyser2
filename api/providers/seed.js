// api/providers/seed.js
import { prisma } from '../../lib/db.js';
import { PROVIDERS } from '../../lib/providers/config.js';

async function main() {
  for (const [key, cfg] of Object.entries(PROVIDERS)) {
    await prisma.provider.upsert({
      where: { key },
      update: {
        label: key.toUpperCase(),
        minViews: cfg.minViews ?? 0,
        minEngRate: cfg.minEngRate ?? 0,
        minAccountFoll: cfg.minAccountFoll ?? 0,
        baseWeight: cfg.baseWeight ?? 1.0,
        freshnessHalfLifeHours: cfg.halfLifeHrs ?? 168,
        credibility: cfg.credibility ?? 0.8
      },
      create: {
        key,
        label: key.toUpperCase(),
        minViews: cfg.minViews ?? 0,
        minEngRate: cfg.minEngRate ?? 0,
        minAccountFoll: cfg.minAccountFoll ?? 0,
        baseWeight: cfg.baseWeight ?? 1.0,
        freshnessHalfLifeHours: cfg.halfLifeHrs ?? 168,
        credibility: cfg.credibility ?? 0.8
      }
    });
  }
  console.log('Providers seeded.');
}

main()
  .then(async () => { await prisma.$disconnect(); process.exit(0); })
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
