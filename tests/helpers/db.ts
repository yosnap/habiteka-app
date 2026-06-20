/**
 * Utilidades de los tests de integración contra Postgres real.
 *
 * No se mockea Prisma: los tests validan migraciones, `jsonb`, locks de fila y
 * constraints SQL que un mock ocultaría. `resetDb` deja la base limpia entre
 * tests truncando las tablas de negocio (no las de seed/config).
 */
import { prisma } from '@/server/db/prisma';

let counter = 0;
/** Sufijo único por proceso para evitar choques de claves entre tests. */
export function uniqueSuffix(): string {
  counter += 1;
  return `${process.pid}-${counter}`;
}

/** Trunca las tablas de negocio. Mantiene model_config/system_setting (seed). */
export async function resetDb(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "credit_ledger", "credit_hold", "credit_balance", "subscription",
      "project", "member", "organization", "user",
      "audit_log", "usage_event", "processed_webhook_event"
    RESTART IDENTITY CASCADE
  `);
}

/** Crea un usuario mínimo (las FKs de organización/miembro lo requieren). */
export async function makeUser(
  email?: string,
): Promise<{ id: string; email: string; name: string }> {
  const id = `user-${uniqueSuffix()}`;
  const finalEmail = email ?? `${id}@example.com`;
  await prisma.user.create({
    data: { id, name: `User ${id}`, email: finalEmail, emailVerified: true },
  });
  return { id, email: finalEmail, name: `User ${id}` };
}

/** Crea una organización con su saldo inicial. Devuelve su id. */
export async function makeOrg(initialBalance = 0): Promise<string> {
  const id = `org-${uniqueSuffix()}`;
  await prisma.organization.create({
    data: {
      id,
      name: `Org ${id}`,
      accountType: 'B2C',
      creditBalance: { create: { balance: initialBalance } },
    },
  });
  return id;
}
