/**
 * Conversión del coste medido a créditos.
 *
 * El agente y el feedback reportan el coste real (tokens del chat o coste por
 * imagen del proveedor). Aquí se traduce a una cantidad entera de créditos según
 * la tarifa, redondeando hacia arriba para no infravalorar el cobro.
 */
import type { TokenUsage } from '@/lib/contracts';
import { DEFAULT_PRICING, type PricingTable } from './pricing-table';

/** Créditos correspondientes a un uso de tokens de chat. */
export function tokensToCredits(
  usage: TokenUsage,
  pricing: PricingTable = DEFAULT_PRICING,
): number {
  const total = usage.promptTokens + usage.completionTokens;
  return Math.max(1, Math.ceil((total / 1000) * pricing.creditsPer1kTokens));
}

/** Créditos por una imagen generada/inpaintada (cobro por unidad, no por importe). */
export function imageToCredits(pricing: PricingTable = DEFAULT_PRICING): number {
  return Math.max(1, pricing.creditsPerImage);
}
