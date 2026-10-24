import type { ModelAction } from '@/generated/prisma/enums';
import { prisma } from '@/server/db/prisma';
import { allowedModel } from '@/server/admin/config/model-allowlist';
import type { ModelRouteTarget } from './model-defaults';

/**
 * Modelos que la organización eligió para un uso, en orden, quitando los que el panel ya no ofrece (retirados o
 * deprecados). Lista vacía cuando no eligió ninguno o todos se retiraron: entonces manda la recomendación del panel.
 */
export async function organizationRouteTargets(organizationId: string, action: ModelAction): Promise<ModelRouteTarget[]> {
  let rows: { provider: string; model: string }[];
  try {
    rows = await prisma.organizationModelRoute.findMany({
      where: { organizationId, action }, orderBy: { position: 'asc' }, select: { provider: true, model: true },
    });
  } catch {
    // Sin la tabla (base sin migrar) o con la base caída se usa la recomendación, como antes de existir la elección.
    return [];
  }
  return rows
    .filter(({ provider, model }) => { const allowed = allowedModel(action, model, provider); return !!allowed && allowed.status !== 'deprecated'; })
    .map(({ provider, model }) => ({ provider, model, baseURL: null }));
}
