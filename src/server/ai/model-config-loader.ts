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
import { MODEL_DEFAULTS, type ModelRoute } from './model-defaults';

let cache: Map<ModelAction, ModelRoute> | null = null;

/** Descarta la caché; el panel de configuración lo invoca tras editar la tabla. */
export function invalidate(): void {
  cache = null;
}

async function load(): Promise<Map<ModelAction, ModelRoute>> {
  const map = new Map<ModelAction, ModelRoute>();
  try {
    const rows = await prisma.modelConfig.findMany({ where: { enabled: true } });
    for (const row of rows) {
      map.set(row.action, {
        primaryModel: row.primaryModel,
        fallbacks: row.fallbacks,
        provider: row.provider,
        baseURL: row.baseURL,
      });
    }
  } catch {
    // Lectura fallida: se cae al respaldo en código (no se propaga el error).
    return new Map(Object.entries(MODEL_DEFAULTS) as Array<[ModelAction, ModelRoute]>);
  }
  return map;
}

/** Devuelve la ruta de modelo para una acción, con respaldo seguro. */
export async function getModelConfig(action: ModelAction): Promise<ModelRoute> {
  if (!cache) {
    cache = await load();
  }
  return cache.get(action) ?? MODEL_DEFAULTS[action];
}
