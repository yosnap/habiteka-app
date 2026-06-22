/**
 * Utilidades de los tests de integración contra Postgres real.
 *
 * No se mockea Prisma: los tests validan migraciones, `jsonb`, locks de fila y
 * constraints SQL que un mock ocultaría. `resetDb` deja la base limpia de datos
 * de prueba entre tests, PERO preserva el usuario admin de desarrollo (y todo lo
 * suyo): trabajamos siempre sobre la misma BD de dev y el login no debe perderse
 * al correr la suite (antes un TRUNCATE total borraba el admin).
 */
import { prisma } from '@/server/db/prisma';

/** Email del usuario admin de desarrollo (debe coincidir con prisma/dev-seed.ts). */
export const DEV_USER_EMAIL = 'admin@habiteka.dev';

let counter = 0;
/** Sufijo único por proceso para evitar choques de claves entre tests. */
export function uniqueSuffix(): string {
  counter += 1;
  return `${process.pid}-${counter}`;
}

/**
 * Borra los datos de prueba preservando al usuario admin de dev y su organización.
 *
 * Se borra TODO menos las filas del admin: se calculan sus ids (user, org) y se
 * excluyen del borrado; el resto se elimina respetando el orden de las FKs (de
 * hijos a padres). Las tablas de seed/config (model_config/system_setting) ni se
 * tocan. Si no existe el admin (BD recién creada sin seed), borra todo como antes.
 */
export async function resetDb(): Promise<void> {
  const dev = await prisma.user.findUnique({
    where: { email: DEV_USER_EMAIL },
    select: { id: true, members: { select: { organizationId: true } } },
  });
  const keepUserIds = dev ? [dev.id] : [];
  const keepOrgIds = dev ? dev.members.map((m) => m.organizationId) : [];

  // Tablas ligadas al admin: borrado FILTRADO (preserva lo suyo), hijos antes que
  // padres por las FKs. Cada deleteMany excluye el user/org del admin.
  await prisma.$transaction([
    prisma.creditLedger.deleteMany({ where: { organizationId: { notIn: keepOrgIds } } }),
    prisma.creditHold.deleteMany({ where: { organizationId: { notIn: keepOrgIds } } }),
    prisma.creditBalance.deleteMany({ where: { organizationId: { notIn: keepOrgIds } } }),
    prisma.subscription.deleteMany({ where: { organizationId: { notIn: keepOrgIds } } }),
    prisma.consentRecord.deleteMany({ where: { userId: { notIn: keepUserIds } } }),
    prisma.tosAcceptance.deleteMany({ where: { userId: { notIn: keepUserIds } } }),
    prisma.cookieConsent.deleteMany({ where: { userId: { notIn: keepUserIds } } }),
    prisma.project.deleteMany({ where: { organizationId: { notIn: keepOrgIds } } }),
    prisma.member.deleteMany({ where: { organizationId: { notIn: keepOrgIds } } }),
    prisma.organization.deleteMany({ where: { id: { notIn: keepOrgIds } } }),
    prisma.user.deleteMany({ where: { id: { notIn: keepUserIds } } }),
  ]);

  // Tablas globales sin lazo con el admin. audit_log/usage_event son append-only
  // (un trigger bloquea DELETE); se vacían con TRUNCATE, que el trigger no dispara.
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "audit_log", "usage_event", "processed_webhook_event",
      "media_asset", "media_folder"
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
