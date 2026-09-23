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

/** Bandas de fiabilidad de Jev: ≥ proceed sigue solo, ≥ confirm pide confirmación. */
export const QUALITY_THRESHOLDS_SETTING = 'quality_thresholds';

/** Persiste un ajuste tras validarlo según su tipo; registra la acción. */
export async function updateSystemSetting(
  actorId: string,
  key: string,
  value: unknown,
): Promise<void> {
  if (key in INTEGER_SETTINGS) {
    assertNonNegativeInteger(key, value, INTEGER_SETTINGS[key]!);
  }
  if (key === QUALITY_THRESHOLDS_SETTING) {
    assertQualityThresholds(value);
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

function assertQualityThresholds(value: unknown): void {
  const raw = value as { proceed?: unknown; confirm?: unknown } | null;
  for (const band of ['proceed', 'confirm'] as const) {
    const candidate = raw?.[band];
    if (typeof candidate !== 'number' || !Number.isInteger(candidate) || candidate < 0 || candidate > 100) {
      throw configError(`quality_thresholds.${band} debe ser un entero entre 0 y 100`);
    }
  }
  if ((raw!.confirm as number) >= (raw!.proceed as number)) {
    throw configError('quality_thresholds.confirm debe ser menor que proceed');
  }
}

function assertNonNegativeInteger(key: string, value: unknown, ceiling: number): void {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw configError(`${key} debe ser un entero no negativo`);
  }
  if (value > ceiling) {
    throw configError(`${key} supera el máximo permitido (${ceiling})`);
  }
}
