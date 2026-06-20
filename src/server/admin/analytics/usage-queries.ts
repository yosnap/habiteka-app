/**
 * Agregaciones de uso para el panel de analítica (solo lectura).
 *
 * Suma la telemetría de uso y el consumo de créditos por rango de fecha, sin
 * mutar nada. Una regla importante: tokens e imágenes son unidades distintas y NO
 * se mezclan en un mismo total; se agregan por separado para que las cifras
 * signifiquen algo.
 */
import type { UsageUnit } from '@/generated/prisma/enums';
import { prisma } from '@/server/db/prisma';

export interface DateRange {
  from: Date;
  to: Date;
}

export interface UsageByAction {
  action: string;
  unit: UsageUnit;
  totalAmount: number;
  totalCostUsd: number;
  events: number;
}

/** Agrega el uso por acción y unidad en un rango (tokens e imágenes separados). */
export async function usageByAction(range: DateRange): Promise<UsageByAction[]> {
  const grouped = await prisma.usageEvent.groupBy({
    by: ['action', 'unit'],
    where: { createdAt: { gte: range.from, lte: range.to } },
    _sum: { amount: true, cost: true },
    _count: { _all: true },
  });
  return grouped.map((g) => ({
    action: g.action,
    unit: g.unit,
    totalAmount: g._sum.amount ?? 0,
    totalCostUsd: g._sum.cost ? Number(g._sum.cost) : 0,
    events: g._count._all,
  }));
}

/** Número de usuarios distintos con actividad en el rango (usuarios activos). */
export async function activeUsers(range: DateRange): Promise<number> {
  const rows = await prisma.usageEvent.findMany({
    where: { createdAt: { gte: range.from, lte: range.to }, userId: { not: null } },
    distinct: ['userId'],
    select: { userId: true },
  });
  return rows.length;
}

/** Créditos consumidos (delta negativo del ledger) por organización en el rango. */
export async function creditsConsumedByOrg(
  range: DateRange,
): Promise<Array<{ organizationId: string; consumed: number }>> {
  const grouped = await prisma.creditLedger.groupBy({
    by: ['organizationId'],
    where: { createdAt: { gte: range.from, lte: range.to }, delta: { lt: 0 } },
    _sum: { delta: true },
  });
  return grouped.map((g) => ({
    organizationId: g.organizationId,
    // El consumo se reporta en positivo (el ledger lo guarda como delta negativo).
    consumed: Math.abs(g._sum.delta ?? 0),
  }));
}
