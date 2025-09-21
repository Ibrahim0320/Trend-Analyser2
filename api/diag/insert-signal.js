// api/diag/insert-signal.js
export const config = { runtime: 'nodejs' };

import { prisma } from '../../lib/db.js';

export default async function handler(_req, res) {
  try {
    const row = await prisma.signal.create({
      data: {
        region: 'Test',
        entity: 'diagnostic',
        entityType: 'theme',
        provider: 'diag',
        observedAt: new Date(),
        // All other fields in your schema are optional (Int?/Float?), so we omit them here
      },
    });
    res.status(200).json({ ok: true, id: row.id });
  } catch (e) {
    res.status(500).json({ ok: false, where: 'signal.create', error: String(e?.code ? `${e.code}: ${e.message}` : e?.stack || e) });
  }
}
