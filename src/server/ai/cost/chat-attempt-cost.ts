import type { TokenUsage } from '@/lib/contracts';

/**
 * No confundir la reserva del guardia con una tarifa real. Si el proveedor no informa del coste pero el administrador
 * declaró un precio por 1M tokens (proveedores propios), se estima con él y se marca como estimado.
 */
export function chatAttemptCost(usage?: TokenUsage, pricePerMillionUsd?: number) {
  const value = usage?.reportedCostUsd;
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return { costUsd: value, costType: 'confirmed' as const };
  if (usage && typeof pricePerMillionUsd === 'number' && pricePerMillionUsd >= 0)
    return { costUsd: (usage.promptTokens + usage.completionTokens) / 1e6 * pricePerMillionUsd, costType: 'estimated' as const };
  return { costType: 'unknown' as const };
}
