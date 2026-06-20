/**
 * Estimación de coste en créditos para el preview de la UI (antes de generar).
 *
 * Es una cota previa al coste medido: la UI la muestra para que el usuario
 * confirme con conocimiento del precio aproximado. El cobro real lo ajusta el
 * débito con el coste medido tras la generación.
 */
import type { DeliverableType } from '@/lib/contracts';
import { DEFAULT_PRICING, type PricingTable } from './pricing-table';

/** Créditos estimados para generar un entregable de un tipo. */
export function estimateDeliverableCost(
  type: DeliverableType,
  pricing: PricingTable = DEFAULT_PRICING,
): number {
  const base = pricing.baseByDeliverable[type];
  // Render e inpaint añaden el coste por imagen sobre la base.
  if (type === 'render3d') return base + pricing.creditsPerImage;
  return base;
}

/** Créditos estimados para una iteración de feedback (render → imagen). */
export function estimateIterationCost(
  type: DeliverableType,
  pricing: PricingTable = DEFAULT_PRICING,
): number {
  if (type === 'render3d') return pricing.creditsPerImage;
  return pricing.baseByDeliverable[type];
}
