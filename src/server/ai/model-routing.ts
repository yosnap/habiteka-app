/**
 * Resuelve la ruta efectiva (modelo + respaldos + gateway) para una acción.
 *
 * Aplica dos invariantes de seguridad/robustez sobre lo que devuelve la config:
 *  - como mucho 3 modelos de respaldo (límite de OpenRouter);
 *  - el `provider`/`baseURL` debe salir de una allowlist: un valor editado en el
 *    panel nunca puede apuntar el tráfico a un gateway arbitrario.
 */
import type { ModelAction } from '@/generated/prisma/enums';
import { getModelRoutes } from './model-config-loader';

export const MAX_FALLBACKS = 3;

// Gateways permitidos. El primario (OpenRouter) se representa con `null`.
const GATEWAY_ALLOWLIST: Record<string, string> = {
  openrouter: 'https://openrouter.ai/api/v1',
  nan: 'https://api.nan.builders/v1',
};

export interface ResolvedRoute {
  model: string;
  provider: 'openrouter' | 'kie' | 'nan' | 'openai';
  /** baseURL del gateway a usar, o null para el primario por defecto. */
  baseURL: string | null;
  /** Campos de compatibilidad para consumidores legacy de resolveRoute. */
  primaryModel?: string;
  fallbacks: string[];
}

export async function resolveRoutes(action: ModelAction): Promise<ResolvedRoute[]> {
  const routes = await getModelRoutes(action);
  return routes.slice(0, MAX_FALLBACKS + 1).map((route) => {
    const provider = resolveProvider(route.provider);
    return { model: route.model, provider, baseURL: resolveBaseURL(route.baseURL, provider), fallbacks: [] };
  });
}

/** @deprecated Usa resolveRoutes: preservado temporalmente para consumidores externos. */
export async function resolveRoute(action: ModelAction): Promise<ResolvedRoute> {
  const [route, ...backups] = await resolveRoutes(action);
  if (!route) throw new Error(`No hay ruta de IA para ${action}`);
  return { ...route, primaryModel: route.model, fallbacks: backups.map((backup) => backup.model) };
}

function resolveProvider(provider: string): 'openrouter' | 'kie' | 'nan' | 'openai' {
  return provider === 'kie' || provider === 'nan' || provider === 'openai' ? provider : 'openrouter';
}

function resolveBaseURL(baseURL: string | null, provider: 'openrouter' | 'kie' | 'nan' | 'openai'): string | null {
  if (provider === 'kie' || provider === 'openai') return null;
  // OpenRouter también pasa por la allowlist: un baseURL editado a mano nunca desvía tráfico (ni la clave) a otro host.
  if (provider === 'openrouter') return null;
  const allowed = GATEWAY_ALLOWLIST[provider];
  if (!allowed) {
    // Provider fuera de la allowlist: se ignora y se usa el primario por defecto.
    return null;
  }
  // Si la config trae un baseURL, debe coincidir con el de la allowlist.
  if (baseURL && baseURL !== allowed) {
    return null;
  }
  return allowed;
}
