export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  const out = { ok: false, checks: {} };

  // 1) Basic runtime
  out.checks.node = process.version;
  out.checks.cwd = process.cwd();

  // 2) Env presence (values redacted)
  const need = ['DATABASE_URL', 'OPENAI_API_KEY', 'YOUTUBE_API_KEY'];
  out.checks.env = Object.fromEntries(need.map((k) => [k, !!process.env[k]]));

  // 3) Can we import Prisma client?
  let PrismaClient;
  try {
    const mod = await import('../../node_modules/@prisma/client/index.js');
    PrismaClient = mod.PrismaClient;
    out.checks.prismaImport = true;
  } catch (e) {
    out.checks.prismaImport = false;
    out.error = 'Failed to import @prisma/client';
    out.details = String(e?.stack || e);
    return res.status(500).json(out);
  }

  // 4) Try DB connectivity and a simple query
  const prisma = new PrismaClient();
  try {
    // Quick connectivity check
    await prisma.$connect();
    out.checks.dbConnect = true;
  } catch (e) {
    out.checks.dbConnect = false;
    out.error = 'Prisma connect failed';
    out.details = String(e?.code ? `${e.code}: ${e.message}` : e?.stack || e);
    try { await prisma.$disconnect(); } catch {}
    return res.status(500).json(out);
  }

  try {
    // Existence of any table or at least raw query
    await prisma.$queryRaw`SELECT 1`;
    out.checks.dbQuery = true;
  } catch (e) {
    out.checks.dbQuery = false;
    out.error = 'DB query failed (schema not deployed?)';
    out.details = String(e?.code ? `${e.code}: ${e.message}` : e?.stack || e);
    try { await prisma.$disconnect(); } catch {}
    return res.status(500).json(out);
  }

  try { await prisma.$disconnect(); } catch {}

  out.ok = true;
  return res.status(200).json(out);
}
