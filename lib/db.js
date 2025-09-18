import { PrismaClient } from '@prisma/client'

// prevent multiple instances in serverless dev
globalThis.__prisma = globalThis.__prisma || new PrismaClient()
const prisma = globalThis.__prisma

export default prisma
