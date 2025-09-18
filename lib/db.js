// lib/db.js
import { PrismaClient } from '@prisma/client';
export const prisma = globalThis.prisma ?? new PrismaClient();
if (!globalThis.prisma) globalThis.prisma = prisma;
