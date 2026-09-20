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

/** Ruta ejecutable: el proveedor forma parte de cada respaldo. */
export interface ModelRouteTarget {
  model: string;
  provider: string;
  baseURL: string | null;
}

export const MODEL_DEFAULTS: Record<ModelAction, ModelRoute> = {
  vision: {
    primaryModel: 'google/gemini-3.7-flash',
    fallbacks: ['anthropic/claude-sonnet-5'],
    provider: null,
    baseURL: null,
  },
  chat: {
    primaryModel: 'anthropic/claude-sonnet-5',
    fallbacks: ['openai/gpt-5.2-chat'],
    provider: null,
    baseURL: null,
  },
  plano2d: {
    primaryModel: 'anthropic/claude-sonnet-5',
    fallbacks: ['openai/gpt-5.2-chat'],
    provider: null,
    baseURL: null,
  },
  // Modelos de IMAGEN: deben aceptar imagen de referencia por el canal de chat
  // con modalidades de OpenRouter (el que usa el proveedor por defecto). Flux
  // no lo soporta ahí: responde 400 en cuanto viaja una referencia.
  render3d: {
    primaryModel: 'google/gemini-3.1-flash-image',
    fallbacks: [],
    provider: null,
    baseURL: null,
  },
  inpaint: {
    primaryModel: 'google/gemini-3.1-flash-image',
    fallbacks: [],
    provider: null,
    baseURL: null,
  },
  memoria: {
    primaryModel: 'anthropic/claude-sonnet-5',
    fallbacks: ['openai/gpt-5.2-chat'],
    provider: null,
    baseURL: null,
  },
};
