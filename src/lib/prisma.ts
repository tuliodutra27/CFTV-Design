import { PrismaClient } from '@prisma/client';

// Evita esgotar conexões com o Postgres por causa do hot-reload do `next dev`
// (cada reload recriaria um novo PrismaClient se não fosse cacheado no global).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
