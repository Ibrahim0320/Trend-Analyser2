// lib/db.js
import { PrismaClient } from '@prisma/client';

/**
 * Create a single PrismaClient across hot reloads / serverless invocations.
 * Works on Vercel (serverless) and locally.
 */
const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.__PRISMA__ ??
  new PrismaClient({
    log: ['warn', 'error'], // reduce noise; add 'query' if you want to debug
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__PRISMA__ = prisma;
}

// Export default too so legacy default imports won't crash.
export default prisma;
