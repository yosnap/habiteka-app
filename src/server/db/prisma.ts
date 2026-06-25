import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Cliente Prisma único por proceso. En desarrollo el hot-reload de Next recrea
// los módulos en cada cambio; sin este singleton se abrirían conexiones nuevas
// hasta agotar el pool de Postgres. En Prisma 7 la conexión se establece vía
// driver adapter (no por `url` en el schema).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL no está definida');
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
