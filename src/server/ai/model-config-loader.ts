/**
 * Lectura cacheada del mapeo acción→modelo desde la base de datos.
 *
 * El mapa es dato editable (`ModelConfig`), no constante: el back-office lo
 * cambia y llama a `invalidate()` para que la siguiente llamada IA use el modelo
 * nuevo sin redeploy. Si la tabla está vacía o la lectura falla, se devuelve el
 * respaldo en código: la IA nunca queda sin modelo.
 */
import type { ModelAction } from '@/generated/prisma/enums';
import { prisma } from '@/server/db/prisma';
import { MODEL_DEFAULTS, type ModelRoute, type ModelRouteTarget } from './model-defaults';

let cache: Map<ModelAction, ModelRouteTarget[]> | null = null;

/** Descarta la caché; el panel de configuración lo invoca tras editar la tabla. */
export function invalidate(): void {
  cache = null;
}

async function load(): Promise<Map<ModelAction, ModelRouteTarget[]>> {
  const map = new Map<ModelAction, ModelRouteTarget[]>();
  try {
    const [configs, routes] = await Promise.all([
      prisma.modelConfig.findMany({ where: { enabled: true } }),
      prisma.aiModelRoute.findMany({ where: { enabled: true }, orderBy: [{ action: 'asc' }, { position: 'asc' }] }),
    ]);
    for (const route of routes) {
      const chain = map.get(route.action) ?? [];
      chain.push({ model: route.model, provider: route.provider, baseURL: null });
      map.set(route.action, chain);
    }
    // Compatibilidad con filas antiguas o fixtures que todavía no tienen rutas.
    for (const config of configs) {
      if (!map.has(config.action)) {
        map.set(config.action, legacyTargets(config));
      }
    }
  } catch {
    // Lectura fallida: se cae al respaldo en código (no se propaga el error).
    return new Map(Object.entries(MODEL_DEFAULTS).map(([action, route]) => [action as ModelAction, legacyTargets(route)]));
  }
  return map;
}

/** Cadena efectiva, primaria primero; cada elemento contiene su proveedor. */
export async function getModelRoutes(action: ModelAction): Promise<ModelRouteTarget[]> {
  if (!cache) cache = await load();
  return cache.get(action) ?? legacyTargets(MODEL_DEFAULTS[action]);
}

/** Compatibilidad con consumidores antiguos: devuelve la ruta como strings. */
export async function getModelConfig(action: ModelAction): Promise<ModelRoute> {
  const [primary, ...backups] = await getModelRoutes(action);
  const fallback = MODEL_DEFAULTS[action];
  return {
    primaryModel: primary?.model ?? fallback.primaryModel,
    fallbacks: backups.map((target) => target.model),
    provider: primary?.provider ?? fallback.provider,
    baseURL: primary?.baseURL ?? fallback.baseURL,
  };
}

function legacyTargets(route: ModelRoute): ModelRouteTarget[] {
  const provider = route.provider ?? 'openrouter';
  return [
    { model: route.primaryModel, provider, baseURL: route.baseURL },
    ...route.fallbacks.map((model) => ({ model, provider, baseURL: route.baseURL })),
  ];
}
