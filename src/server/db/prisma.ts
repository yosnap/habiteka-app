import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { assertTestDatabaseUrl, isTestProcess } from './test-database-guard';
import { TestDatabaseAdapter } from './test-database-adapter';

// Cliente Prisma único por proceso. En desarrollo el hot-reload de Next recrea
// los módulos en cada cambio; sin este singleton se abrirían conexiones nuevas
// hasta agotar el pool de Postgres. En Prisma 7 la conexión se establece vía
// driver adapter (no por `url` en el schema).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const testProcess = isTestProcess();
const connectionString = process.env.DATABASE_URL;
// Capture and validate the actual destination, not a later mutable env value.
if (testProcess) assertTestDatabaseUrl(connectionString);

function createPrismaClient(): PrismaClient {
  if (!connectionString) {
    throw new Error('DATABASE_URL no está definida');
  }
  const adapter = testProcess
    ? new TestDatabaseAdapter(connectionString)
    : new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

// A test must never inherit a development singleton from the same process.
const client = testProcess
  ? createPrismaClient()
  : (globalForPrisma.prisma ?? createPrismaClient());
export const prisma = client;

if (process.env.NODE_ENV !== 'production') {
  if (!testProcess) globalForPrisma.prisma = client;
}
