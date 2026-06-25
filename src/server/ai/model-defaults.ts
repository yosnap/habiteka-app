/**
 * Mapa de modelos por acción en código.
 *
 * Es el respaldo seguro: si la configuración en base de datos está vacía o no se
 * puede leer, la IA nunca queda sin modelo. La fuente normal es `ModelConfig`
 * (editable desde el back-office); esto solo garantiza un arranque funcional.
 */
import type { ModelAction } from '@/generated/prisma/enums';

export interface ModelRoute {
  primaryModel: string;
  /** Modelos de respaldo (máx. 3). OpenRouter los intenta en orden. */
  fallbacks: string[];
  /** Gateway/proveedor a usar; null ⇒ el primario por defecto (OpenRouter). */
  provider: string | null;
  baseURL: string | null;
}

export const MODEL_DEFAULTS: Record<ModelAction, ModelRoute> = {
  vision: {
    primaryModel: 'google/gemini-2.5-flash',
    fallbacks: ['anthropic/claude-3.7-sonnet'],
    provider: null,
    baseURL: null,
  },
  chat: {
    primaryModel: 'anthropic/claude-3.7-sonnet',
    fallbacks: ['openai/gpt-4o'],
    provider: null,
    baseURL: null,
  },
  plano2d: {
    primaryModel: 'anthropic/claude-3.7-sonnet',
    fallbacks: ['openai/gpt-4o'],
    provider: null,
    baseURL: null,
  },
  render3d: {
    primaryModel: 'black-forest-labs/flux-1.1-pro',
    fallbacks: [],
    provider: null,
    baseURL: null,
  },
  inpaint: {
    primaryModel: 'black-forest-labs/flux-1.1-pro',
    fallbacks: [],
    provider: null,
    baseURL: null,
  },
  memoria: {
    primaryModel: 'anthropic/claude-3.7-sonnet',
    fallbacks: ['openai/gpt-4o'],
    provider: null,
    baseURL: null,
  },
};
