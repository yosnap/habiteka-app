/**
 * Allowlist curada de modelos por acción, con techo de precio.
 *
 * La edición de la configuración de modelos NO admite un id de modelo arbitrario:
 * solo modelos de esta lista, y nunca por encima del techo de precio de la acción.
 * Es la barrera contra un cambio (malicioso o por error) que apunte a un modelo
 * carísimo. La capa de IA también valida contra esta lista antes de usar un modelo
 * leído de la base de datos, de modo que una fila corrupta cae al modelo por
 * defecto en lugar de facturarse.
 */
import type { ModelAction } from '@/generated/prisma/enums';

export interface AllowedModel {
  id: string;
  /** Precio orientativo por 1M tokens (o por imagen), para el techo por acción. */
  priceUsdPerUnit: number;
}

// Modelos permitidos por acción. Mantener sincronizado con lo que el proveedor
// ofrece; ampliar aquí es la vía controlada de habilitar un modelo nuevo.
const ALLOWED: Record<ModelAction, AllowedModel[]> = {
  vision: [
    { id: 'google/gemini-2.5-flash', priceUsdPerUnit: 0.3 },
    { id: 'anthropic/claude-3.7-sonnet', priceUsdPerUnit: 3 },
  ],
  chat: [
    { id: 'anthropic/claude-3.7-sonnet', priceUsdPerUnit: 3 },
    { id: 'openai/gpt-4o', priceUsdPerUnit: 5 },
  ],
  plano2d: [
    { id: 'anthropic/claude-3.7-sonnet', priceUsdPerUnit: 3 },
    { id: 'openai/gpt-4o', priceUsdPerUnit: 5 },
  ],
  render3d: [{ id: 'black-forest-labs/flux-1.1-pro', priceUsdPerUnit: 0.04 }],
  inpaint: [{ id: 'black-forest-labs/flux-1.1-pro', priceUsdPerUnit: 0.04 }],
  memoria: [
    { id: 'anthropic/claude-3.7-sonnet', priceUsdPerUnit: 3 },
    { id: 'openai/gpt-4o', priceUsdPerUnit: 5 },
  ],
};

// Techo de precio por acción: ningún modelo más caro que esto puede configurarse.
const PRICE_CEILING: Record<ModelAction, number> = {
  vision: 4,
  chat: 6,
  plano2d: 6,
  render3d: 0.1,
  inpaint: 0.1,
  memoria: 6,
};

/** Modelos elegibles para una acción (para el selector cerrado de la UI). */
export function allowedModels(action: ModelAction): AllowedModel[] {
  return ALLOWED[action];
}

/** Verdadero si el modelo está permitido para la acción y no supera el techo. */
export function isModelAllowed(action: ModelAction, modelId: string): boolean {
  const model = ALLOWED[action].find((m) => m.id === modelId);
  if (!model) return false;
  return model.priceUsdPerUnit <= PRICE_CEILING[action];
}
