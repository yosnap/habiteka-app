/**
 * Gate anti-sybil del gasto de cupo GRATIS (bienvenida o iteración gratis).
 *
 * El gasto de créditos COMPRADOS no pasa por aquí (quien pagó ya es de fiar). El
 * cupo gratis sí: exige que el email de la organización esté verificado y que no
 * se supere el límite de cuentas gratis por origen (por IP en el MVP, más costosa
 * de rotar que el dominio de email). Lee la verificación y el origen de los
 * modelos de identidad existentes; no crea estado nuevo.
 */
import { prisma } from '@/server/db/prisma';
import { billingError } from './errors';

const DEFAULT_ORIGIN_LIMIT = 3;

async function readOriginLimit(): Promise<number> {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: 'accounts_per_origin_limit' },
  });
  const value = setting?.value;
  return typeof value === 'number' ? value : DEFAULT_ORIGIN_LIMIT;
}

/**
 * Lanza `BillingError` si la organización no puede gastar cupo gratis: email del
 * dueño sin verificar (`email_unverified`) o demasiadas cuentas desde su IP de
 * origen (`origin_limit`). No tiene efecto sobre el gasto de créditos comprados.
 */
export async function assertFreeQuotaAllowed(organizationId: string): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { originIp: true, members: { select: { user: { select: { emailVerified: true } } } } },
  });
  if (!org) {
    throw billingError('origin_limit', 'Organización no encontrada');
  }

  const ownerVerified = org.members.some((m) => m.user.emailVerified);
  if (!ownerVerified) {
    throw billingError('email_unverified', 'Verifica tu email para usar el cupo gratuito');
  }

  if (org.originIp) {
    const limit = await readOriginLimit();
    const sameOrigin = await prisma.organization.count({ where: { originIp: org.originIp } });
    if (sameOrigin > limit) {
      throw billingError('origin_limit', 'Demasiadas cuentas gratuitas desde este origen');
    }
  }
}
