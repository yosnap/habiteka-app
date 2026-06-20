/**
 * Resuelve la ruta efectiva (modelo + respaldos + gateway) para una acción.
 *
 * Aplica dos invariantes de seguridad/robustez sobre lo que devuelve la config:
 *  - como mucho 3 modelos de respaldo (límite de OpenRouter);
 *  - el `provider`/`baseURL` debe salir de una allowlist: un valor editado en el
 *    panel nunca puede apuntar el tráfico a un gateway arbitrario.
 */
import type { ModelAction } from '@/generated/prisma/enums';
import { getModelConfig } from './model-config-loader';
import type { ModelRoute } from './model-defaults';

export const MAX_FALLBACKS = 3;

// Gateways permitidos. El primario (OpenRouter) se representa con `null`.
const GATEWAY_ALLOWLIST: Record<string, string> = {
  openrouter: 'https://openrouter.ai/api/v1',
};

export interface ResolvedRoute {
  primaryModel: string;
  fallbacks: string[];
  /** baseURL del gateway a usar, o null para el primario por defecto. */
  baseURL: string | null;
}

export async function resolveRoute(action: ModelAction): Promise<ResolvedRoute> {
  const route = await getModelConfig(action);
  return {
    primaryModel: route.primaryModel,
    fallbacks: route.fallbacks.slice(0, MAX_FALLBACKS),
    baseURL: resolveBaseURL(route),
  };
}

function resolveBaseURL(route: ModelRoute): string | null {
  if (!route.provider) return route.baseURL ?? null;
  const allowed = GATEWAY_ALLOWLIST[route.provider];
  if (!allowed) {
    // Provider fuera de la allowlist: se ignora y se usa el primario por defecto.
    return null;
  }
  // Si la config trae un baseURL, debe coincidir con el de la allowlist.
  if (route.baseURL && route.baseURL !== allowed) {
    return null;
  }
  return allowed;
}
