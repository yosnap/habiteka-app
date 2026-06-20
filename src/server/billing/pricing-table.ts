/**
 * Tarifa de conversión coste→créditos.
 *
 * El coste medido (tokens del chat o coste por imagen del proveedor) se traduce a
 * créditos del usuario por estas tasas. Es la única fuente del precio: la
 * calibración real se ajusta aquí a partir del consumo medido, sin tocar la
 * lógica de débito.
 */
import type { DeliverableType } from '@/lib/contracts';

export interface PricingTable {
  /** Créditos por cada 1000 tokens de chat. */
  creditsPer1kTokens: number;
  /** Créditos por imagen generada/inpaintada (render/inpaint). */
  creditsPerImage: number;
  /** Coste base mínimo por tipo de entregable (cobro de suelo). */
  baseByDeliverable: Record<DeliverableType, number>;
}

export const DEFAULT_PRICING: PricingTable = {
  creditsPer1kTokens: 1,
  creditsPerImage: 4,
  baseByDeliverable: {
    plano2d: 5,
    render3d: 8,
    memoria: 2,
  },
};
