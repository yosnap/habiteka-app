/**
 * Resuelve la ruta efectiva (modelo + respaldos + gateway) para una acción y una organización.
 *
 * Aplica dos invariantes de seguridad/robustez sobre lo que devuelve la config:
 *  - como mucho 3 modelos de respaldo (límite de OpenRouter);
 *  - el `provider`/`baseURL` debe salir de una allowlist o del catálogo de la organización: un valor
 *    guardado nunca puede apuntar el tráfico a un gateway arbitrario.
 */
import type { ModelAction } from '@/generated/prisma/enums';
import { BUILT_IN_MODEL_PROVIDERS, loadOrganizationCatalog, type OrganizationCatalog } from './custom-ai-providers';
import { organizationRouteTargets } from './organization-model-routes';
import { MODEL_DEFAULTS, type ModelRouteTarget } from './model-defaults';
import { allowedModel } from './model-catalog';

export const MAX_FALLBACKS = 3;

// Gateways permitidos. El primario (OpenRouter) se representa con `null`.
const GATEWAY_ALLOWLIST: Record<string, string> = {
  openrouter: BUILT_IN_MODEL_PROVIDERS.openrouter!.baseUrl,
  nan: BUILT_IN_MODEL_PROVIDERS.nan!.baseUrl,
  // Solo para modelos de texto y visión: las imágenes de OpenAI van por su propio adaptador, sin esta URL.
  openai: BUILT_IN_MODEL_PROVIDERS.openai!.baseUrl,
  // Modelos Claude de KIE; su adaptador de imagen no usa esta URL.
  kie: BUILT_IN_MODEL_PROVIDERS.kie!.baseUrl,
};

export interface ResolvedRoute {
  model: string;
  /** Proveedor integrado (openrouter, kie, nan, openai) o id de un proveedor propio compatible con OpenAI. */
  provider: string;
  /** Precio del catálogo (por 1M tokens o por imagen): estima el coste cuando el proveedor no lo informa. */
  priceUsdPerUnit?: number;
  /** Nombre del modelo en el catálogo, para enseñarlo en presupuestos. */
  label?: string;
  /** baseURL del gateway a usar, o null para el primario por defecto. */
  baseURL: string | null;
  /** Campos de compatibilidad para consumidores legacy de resolveRoute. */
  primaryModel?: string;
  fallbacks: string[];
}

/** Cadena recomendada por Habiteka para un uso: fija en el código, igual para todas las organizaciones. */
export function recommendedTargets(action: ModelAction): ModelRouteTarget[] {
  const route = MODEL_DEFAULTS[action];
  const provider = route.provider ?? 'openrouter';
  return [route.primaryModel, ...route.fallbacks].map((model) => ({ model, provider, baseURL: null }));
}

/**
 * Cadena de la organización para un uso: la que eligió en su perfil o, si no eligió (o se le retiraron todos sus
 * modelos), la recomendada por Habiteka. Cada modelo sale de su catálogo, con su precio y la URL de su proveedor.
 */
export async function resolveRoutes(action: ModelAction, organizationId: string): Promise<ResolvedRoute[]> {
  const catalog = await loadOrganizationCatalog(organizationId);
  const own = await organizationRouteTargets(organizationId, action, catalog);
  const routes = own.length > 0 ? own : recommendedTargets(action);
  return routes.slice(0, MAX_FALLBACKS + 1).map((route) => {
    const provider = resolveProvider(route.provider, catalog);
    const listed = allowedModel(action, route.model, provider, catalog);
    return { model: route.model, provider, baseURL: resolveBaseURL(route.baseURL, provider, catalog), fallbacks: [],
      priceUsdPerUnit: listed?.priceUsdPerUnit, label: listed?.label };
  });
}

/** @deprecated Usa resolveRoutes: preservado temporalmente para consumidores externos. */
export async function resolveRoute(action: ModelAction, organizationId: string): Promise<ResolvedRoute> {
  const [route, ...backups] = await resolveRoutes(action, organizationId);
  if (!route) throw new Error(`No hay ruta de IA para ${action}`);
  return { ...route, primaryModel: route.model, fallbacks: backups.map((backup) => backup.model) };
}

function resolveProvider(provider: string, catalog: OrganizationCatalog): string {
  if (provider === 'kie' || provider === 'nan' || provider === 'openai') return provider;
  // Un proveedor propio solo cuenta si sigue en el catálogo de la organización; uno borrado cae al primario por defecto.
  return catalog.providers.has(provider) ? provider : 'openrouter';
}

function resolveBaseURL(baseURL: string | null, provider: string, catalog: OrganizationCatalog): string | null {
  // Un proveedor propio usa solo la URL que registró la organización (https, validada al guardarla): su clave nunca
  // va a otro sitio aunque una fila de rutas traiga otra URL.
  const custom = catalog.providers.get(provider);
  if (custom) return custom.baseUrl;
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
