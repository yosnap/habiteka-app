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
import { customModels } from '@/server/ai/custom-ai-providers';

/** Proveedor de una ruta: uno integrado (openrouter, kie, nan, openai) o el id de un proveedor propio del panel. */
export type ModelProviderId = string;

export interface AllowedModel {
  id: string;
  provider: ModelProviderId;
  /** Nombre claro para administración; el id es el valor que recibe el proveedor. */
  label: string;
  status: 'current' | 'legacy' | 'deprecated';
  /** Precio orientativo por 1M tokens (o por imagen), para el techo por acción. */
  priceUsdPerUnit: number;
}

// Modelos de imagen de KIE que su documentación confirma para generación y/o
// edición. Se mantienen fuera de los usos de texto: KIE no sustituye el router
// conversacional. El adaptador asíncrono de KIE los ejecutará con el payload
// específico de cada familia.
const kieImageModels: AllowedModel[] = [
  {
    id: 'google/nano-banana',
    provider: 'kie',
    label: 'Google Nano Banana',
    status: 'legacy',
    priceUsdPerUnit: 0.04,
  },
  {
    id: 'nano-banana-pro',
    provider: 'kie',
    label: 'Google Nano Banana Pro',
    status: 'current',
    priceUsdPerUnit: 0.08,
  },
  {
    id: 'nano-banana-2',
    provider: 'kie',
    label: 'Google Nano Banana 2',
    status: 'current',
    priceUsdPerUnit: 0.06,
  },
  {
    // Publicado el 06/10/2026; KIE: 6 créditos por imagen a 2K y hasta 14 referencias.
    id: 'nano-banana-2-1',
    provider: 'kie',
    label: 'Google Nano Banana 2.1',
    status: 'current',
    priceUsdPerUnit: 0.03,
  },
  {
    id: 'nano-banana-2-lite',
    provider: 'kie',
    label: 'Google Nano Banana 2 Lite',
    status: 'current',
    priceUsdPerUnit: 0.03,
  },
  {
    id: 'flux-2/pro-image-to-image',
    provider: 'kie',
    label: 'FLUX.2 Pro · edición con referencias',
    status: 'current',
    priceUsdPerUnit: 0.12,
  },
  {
    id: 'flux-2/flex-image-to-image',
    provider: 'kie',
    label: 'FLUX.2 Flex · control estructural',
    status: 'current',
    priceUsdPerUnit: 0.15,
  },
  {
    id: 'gpt-image-2-5-sunburst-image-to-image',
    provider: 'kie',
    label: 'GPT Image 2.5 Sunburst · precisión de edición',
    status: 'current',
    priceUsdPerUnit: 0.15,
  },
  {
    // Variante orientada a rapidez; la calidad debe comprobarse en cada resultado.
    id: 'gpt-image-2-5-flare-image-to-image',
    provider: 'kie',
    label: 'GPT Image 2.5 Flare · generación rápida',
    status: 'current',
    priceUsdPerUnit: 0.08,
  },
];

const openAiImageModels: AllowedModel[] = [{
  id: 'gpt-image-2', provider: 'openai', label: 'GPT Image 2 · OpenAI directo',
  status: 'current', priceUsdPerUnit: 0.15,
}];

// Catálogo actual de NaN para chat/visión. Se excluyen embeddings, rerank, voz y
// Flux hasta que esas capacidades tengan un adaptador en Habiteka.
const nanChatModels: AllowedModel[] = [
  {
    id: 'deepseek-v4-flash',
    provider: 'nan',
    label: 'NaN DeepSeek V4 Flash',
    status: 'current',
    priceUsdPerUnit: 0.1,
  },
  {
    id: 'glm5.3-flash',
    provider: 'nan',
    label: 'NaN GLM 5.3 Flash',
    status: 'current',
    priceUsdPerUnit: 0.12,
  },
  {
    id: 'qwen3.8-flash',
    provider: 'nan',
    label: 'NaN Qwen 3.8 Flash',
    status: 'current',
    priceUsdPerUnit: 0.08,
  },
  {
    id: 'mimo-v2.5',
    provider: 'nan',
    label: 'NaN MiMo V2.5',
    status: 'current',
    priceUsdPerUnit: 0.14,
  },
  { id: 'gemma4', provider: 'nan', label: 'NaN Gemma 4', status: 'current', priceUsdPerUnit: 0.05 },
  {
    id: 'qwen3.6',
    provider: 'nan',
    label: 'NaN Qwen 3.6',
    status: 'legacy',
    priceUsdPerUnit: 0.08,
  },
];

// Modelos permitidos por acción. Mantener sincronizado con lo que el proveedor
// ofrece; ampliar aquí es la vía controlada de habilitar un modelo nuevo.
const ALLOWED: Record<ModelAction, AllowedModel[]> = {
  vision: [
    ...nanChatModels,
    {
      id: 'google/gemini-3.7-flash',
      provider: 'openrouter',
      label: 'Gemini 3.7 Flash',
      status: 'current',
      priceUsdPerUnit: 0.75,
    },
    {
      id: 'anthropic/claude-sonnet-5',
      provider: 'openrouter',
      label: 'Claude Sonnet 5',
      status: 'current',
      // Precio de entrada publicado por OpenRouter; la salida se contabiliza por uso.
      priceUsdPerUnit: 2,
    },
    {
      id: 'google/gemini-2.5-flash',
      provider: 'openrouter',
      label: 'Gemini 2.5 Flash',
      status: 'legacy',
      priceUsdPerUnit: 0.3,
    },
  ],
  chat: [
    ...nanChatModels,
    {
      id: 'anthropic/claude-sonnet-5',
      provider: 'openrouter',
      label: 'Claude Sonnet 5',
      status: 'current',
      priceUsdPerUnit: 5,
    },
    {
      id: 'openai/gpt-5.2-chat',
      provider: 'openrouter',
      label: 'GPT-5.2 Chat',
      status: 'current',
      priceUsdPerUnit: 5,
    },
    {
      id: 'anthropic/claude-3.7-sonnet',
      provider: 'openrouter',
      label: 'Claude 3.7 Sonnet',
      status: 'deprecated',
      priceUsdPerUnit: 3,
    },
    {
      id: 'openai/gpt-4o',
      provider: 'openrouter',
      label: 'GPT-4o',
      status: 'legacy',
      priceUsdPerUnit: 5,
    },
  ],
  plano2d: [
    ...nanChatModels,
    {
      id: 'anthropic/claude-sonnet-5',
      provider: 'openrouter',
      label: 'Claude Sonnet 5',
      status: 'current',
      priceUsdPerUnit: 5,
    },
    {
      id: 'openai/gpt-5.2-chat',
      provider: 'openrouter',
      label: 'GPT-5.2 Chat',
      status: 'current',
      priceUsdPerUnit: 5,
    },
    {
      id: 'anthropic/claude-3.7-sonnet',
      provider: 'openrouter',
      label: 'Claude 3.7 Sonnet',
      status: 'deprecated',
      priceUsdPerUnit: 3,
    },
    {
      id: 'openai/gpt-4o',
      provider: 'openrouter',
      label: 'GPT-4o',
      status: 'legacy',
      priceUsdPerUnit: 5,
    },
  ],
  render3d: [
    {
      id: 'google/gemini-3-pro-image',
      provider: 'openrouter',
      label: 'Gemini 3 Pro Image (Nano Banana Pro)',
      status: 'current',
      priceUsdPerUnit: 0.12,
    },
    {
      id: 'google/gemini-3.1-flash-image',
      provider: 'openrouter',
      label: 'Gemini 3.1 Flash Image (Nano Banana 2)',
      status: 'current',
      priceUsdPerUnit: 0.06,
    },
    {
      id: 'google/gemini-2.5-flash-image',
      provider: 'openrouter',
      label: 'Gemini 2.5 Flash Image',
      status: 'legacy',
      priceUsdPerUnit: 0.04,
    },
    ...kieImageModels,
    ...openAiImageModels,
  ],
  inpaint: [
    {
      id: 'google/gemini-3-pro-image',
      provider: 'openrouter',
      label: 'Gemini 3 Pro Image (Nano Banana Pro)',
      status: 'current',
      priceUsdPerUnit: 0.12,
    },
    {
      id: 'google/gemini-3.1-flash-image',
      provider: 'openrouter',
      label: 'Gemini 3.1 Flash Image (Nano Banana 2)',
      status: 'current',
      priceUsdPerUnit: 0.06,
    },
    {
      id: 'google/gemini-2.5-flash-image',
      provider: 'openrouter',
      label: 'Gemini 2.5 Flash Image',
      status: 'legacy',
      priceUsdPerUnit: 0.04,
    },
    ...kieImageModels,
    ...openAiImageModels,
  ],
  memoria: [
    ...nanChatModels,
    {
      id: 'anthropic/claude-sonnet-5',
      provider: 'openrouter',
      label: 'Claude Sonnet 5',
      status: 'current',
      priceUsdPerUnit: 5,
    },
    {
      id: 'openai/gpt-5.2-chat',
      provider: 'openrouter',
      label: 'GPT-5.2 Chat',
      status: 'current',
      priceUsdPerUnit: 5,
    },
    {
      id: 'anthropic/claude-3.7-sonnet',
      provider: 'openrouter',
      label: 'Claude 3.7 Sonnet',
      status: 'deprecated',
      priceUsdPerUnit: 3,
    },
    {
      id: 'openai/gpt-4o',
      provider: 'openrouter',
      label: 'GPT-4o',
      status: 'legacy',
      priceUsdPerUnit: 5,
    },
  ],
};

// Techo de precio por acción: ningún modelo más caro que esto puede configurarse.
export const PRICE_CEILING: Record<ModelAction, number> = {
  vision: 4,
  chat: 6,
  plano2d: 6,
  render3d: 0.15,
  inpaint: 0.15,
  memoria: 6,
};

/**
 * Modelos elegibles para una acción (para el selector cerrado de la UI): los curados aquí y los que el administrador
 * habilitó en sus proveedores propios, con el precio que declaró. Los propios exigen haber cargado antes su registro.
 */
export function allowedModels(action: ModelAction): AllowedModel[] {
  return [...ALLOWED[action], ...customModels(action).filter((added) => !includedModel(action, added.model, added.providerId))
    .map(({ model, providerId, providerLabel, label, priceUsdPerUnit, builtIn }) =>
      ({ id: model, provider: providerId, label: builtIn ? label : `${providerLabel} · ${label}`, status: 'current' as const, priceUsdPerUnit }))];
}

/** Modelo que ya viene de serie para el uso, sin habilitarlo desde el panel. */
export function includedModel(action: ModelAction, modelId: string, provider: string): AllowedModel | undefined {
  return ALLOWED[action].find((model) => model.id === modelId && model.provider === provider);
}

export function allowedModel(
  action: ModelAction,
  modelId: string,
  provider?: string | null,
): AllowedModel | undefined {
  return allowedModels(action).find(
    (model) => model.id === modelId && (!provider || model.provider === provider),
  );
}

/** Verdadero si el modelo está permitido para la acción y no supera el techo. */
export function isModelAllowed(
  action: ModelAction,
  modelId: string,
  provider?: string | null,
): boolean {
  const model = allowedModel(action, modelId, provider);
  if (!model) return false;
  return model.priceUsdPerUnit <= PRICE_CEILING[action];
}
