/**
 * Operaciones sobre los ajustes de sistema (flags y límites editables sin
 * redeploy). Los parámetros anti-abuso numéricos se validan como enteros no
 * negativos con un techo razonable, para que un valor erróneo (negativo o
 * desorbitado) no llegue a la base. F2 y la facturación leen el valor actual en
 * cada decisión, así que un cambio surte efecto de inmediato.
 */
import { prisma } from '@/server/db/prisma';
import { writeAudit } from '../audit';
import { configError } from './config-errors';

// Ajustes que deben ser enteros ≥ 0 y por debajo de un techo de cordura.
const INTEGER_SETTINGS: Record<string, number> = {
  welcome_credits: 1_000_000,
  free_iterations_per_deliverable: 1000,
  accounts_per_origin_limit: 10_000,
  global_spend_cap_usd: 1_000_000,
};

/** Persiste un ajuste tras validarlo según su tipo; registra la acción. */
export async function updateSystemSetting(
  actorId: string,
  key: string,
  value: unknown,
): Promise<void> {
  if (key in INTEGER_SETTINGS) {
    assertNonNegativeInteger(key, value, INTEGER_SETTINGS[key]!);
  }

  await prisma.systemSetting.upsert({
    where: { key },
    create: { key, value: value as object },
    update: { value: value as object },
  });

  await writeAudit({
    actorId,
    action: 'update_system_setting',
    targetType: 'system_setting',
    targetId: key,
    meta: { value: value as object },
  });
}

/** Lista los ajustes de sistema actuales. */
export async function listSystemSettings() {
  return prisma.systemSetting.findMany({ orderBy: { key: 'asc' } });
}

function assertNonNegativeInteger(key: string, value: unknown, ceiling: number): void {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw configError(`${key} debe ser un entero no negativo`);
  }
  if (value > ceiling) {
    throw configError(`${key} supera el máximo permitido (${ceiling})`);
  }
}
