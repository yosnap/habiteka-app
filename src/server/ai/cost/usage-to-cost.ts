/**
 * Normaliza el coste reportado por el proveedor a las unidades neutrales del
 * contrato. No traduce a créditos (eso es de la fase de facturación): solo
 * distingue coste por tokens (chat) de coste por imagen (render/inpaint), para
 * que la tarifa pueda cubrir ambas unidades.
 */
import type { TokenUsage, ProviderCost } from '@/lib/contracts';

interface RawUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
}

/** Extrae `TokenUsage` del `usage` nativo de una respuesta de chat. */
export function toTokenUsage(usage: RawUsage | undefined | null): TokenUsage {
  return {
    promptTokens: usage?.prompt_tokens ?? 0,
    completionTokens: usage?.completion_tokens ?? 0,
  };
}

/** Construye un `ProviderCost` por imagen (unidad distinta de los tokens). */
export function imageCost(amountUsd: number): ProviderCost {
  return { amountUsd, unit: 'image' };
}
