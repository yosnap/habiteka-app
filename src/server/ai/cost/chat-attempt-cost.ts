import type { TokenUsage } from '@/lib/contracts';

/** No confundir la reserva del guardia con una tarifa real. */
export function chatAttemptCost(usage?: TokenUsage) {
  const value = usage?.reportedCostUsd;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? { costUsd: value, costType: 'confirmed' as const }
    : { costType: 'unknown' as const };
}
