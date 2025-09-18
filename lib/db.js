// lib/db.js
import { PrismaClient } from '@prisma/client';

let prismaGlobal = globalThis.__prisma;
if (!prismaGlobal) {
  prismaGlobal = new PrismaClient();
  if (process.env.NODE_ENV !== 'production') {
    globalThis.__prisma = prismaGlobal;
  }
}
export const prisma = prismaGlobal;
