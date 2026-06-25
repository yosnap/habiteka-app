/**
 * Techo de gasto AGREGADO de la plataforma (anti-sybil).
 *
 * Complementa el límite por organización (F3): aunque cada cuenta respete su cap,
 * muchas cuentas gratis juntas podrían vaciar el saldo del proveedor. Este guard
 * suma el consumo reciente de toda la plataforma y, si supera el techo
 * configurable, corta la IA para los NO premium (los premium ya pagaron). El
 * importe consumido se lee de la telemetría de uso existente.
 */
import { prisma } from '@/server/db/prisma';
import { billingError } from './errors';

const DEFAULT_GLOBAL_CAP_USD = 500;
const WINDOW_MS = 24 * 60 * 60 * 1000;

async function readGlobalCap(): Promise<number> {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: 'global_spend_cap_usd' },
  });
  const value = setting?.value;
  return typeof value === 'number' ? value : DEFAULT_GLOBAL_CAP_USD;
}

/** Suma el coste de IA de toda la plataforma en la ventana reciente (USD). */
export async function aggregateSpendUsd(now: Date = new Date()): Promise<number> {
  const since = new Date(now.getTime() - WINDOW_MS);
  const result = await prisma.usageEvent.aggregate({
    where: { createdAt: { gte: since } },
    _sum: { cost: true },
  });
  const sum = result._sum.cost;
  return sum ? Number(sum) : 0;
}

/**
 * Lanza `BillingError('global_cap')` si la plataforma superó su techo agregado y
 * la organización no es premium. Un premium no se ve afectado.
 */
export async function assertGlobalCap(isPremium: boolean, now: Date = new Date()): Promise<void> {
  if (isPremium) return;
  const [spend, cap] = await Promise.all([aggregateSpendUsd(now), readGlobalCap()]);
  if (spend >= cap) {
    throw billingError('global_cap', 'Límite global de uso de IA alcanzado; intenta más tarde');
  }
}
