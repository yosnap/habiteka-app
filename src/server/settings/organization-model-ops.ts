import 'server-only';
import type { ModelAction } from '@/generated/prisma/enums';
import { prisma } from '@/server/db/prisma';
import { allowedModel, allowedModels } from '@/server/ai/model-catalog';
import { recommendedTargets } from '@/server/ai/model-routing';
import { loadOrganizationCatalog, providerLabel } from '@/server/ai/custom-ai-providers';
import { organizationRouteTargets } from '@/server/ai/organization-model-routes';
import { MAX_MODEL_BACKUPS, MODEL_USE_GUIDE } from '@/lib/ai-model-guide';
import { fail } from '@/server/errors/run-action';
import type { OrgContext } from '@/server/auth/org-context';
import { canManageAiKeys } from './organization-ai-keys';

/** Modelo tal como lo ve el perfil: proveedor, nombre, precio y si la organización tiene la clave para usarlo. */
export interface ModelChoice { provider: string; providerLabel: string; model: string; label: string; priceUsdPerUnit: number; hasKey: boolean }
export interface ModelUseView {
  action: ModelAction;
  options: ModelChoice[];
  /** Cadena que recomienda Habiteka: la que se usa si la organización no elige. */
  recommended: ModelChoice[];
  /** Cadena elegida por la organización, o null si sigue la recomendación. */
  own: ModelChoice[] | null;
}
export interface ModelRef { provider: string; model: string }

export async function listOrganizationModelUses(ctx: OrgContext): Promise<ModelUseView[]> {
  const catalog = await loadOrganizationCatalog(ctx.organizationId);
  const keys = new Set((await prisma.organizationAiCredential.findMany({
    where: { organizationId: ctx.organizationId }, select: { provider: true },
  })).map((row) => row.provider));
  return Promise.all(MODEL_USE_GUIDE.map(async ({ action }) => {
    const choice = (ref: ModelRef): ModelChoice | null => {
      const allowed = allowedModel(action, ref.model, ref.provider, catalog);
      return allowed ? { provider: ref.provider, providerLabel: providerLabel(ref.provider, catalog), model: ref.model, label: allowed.label,
        priceUsdPerUnit: allowed.priceUsdPerUnit, hasKey: keys.has(ref.provider) } : null;
    };
    const chain = (refs: ModelRef[]) => refs.flatMap((ref) => choice(ref) ?? []);
    const recommended = recommendedTargets(action);
    const own = await organizationRouteTargets(ctx.organizationId, action, catalog);
    const options = chain(allowedModels(action, catalog).filter((model) => model.status !== 'deprecated').map(({ id, provider }) => ({ provider, model: id })));
    return { action, options, recommended: chain(recommended), own: own.length > 0 ? chain(own) : null };
  }));
}

/** Guarda la cadena de un uso (principal y respaldos). Solo modelos que ofrece el panel, sin repetir. */
export async function saveOrganizationModelUse(ctx: OrgContext, action: ModelAction, chain: ModelRef[]): Promise<void> {
  if (!canManageAiKeys(ctx)) fail('Solo el propietario o un administrador de la organización puede cambiar sus modelos.');
  if (!MODEL_USE_GUIDE.some((use) => use.action === action)) fail('Ese uso de IA no existe.');
  if (chain.length === 0) fail('Elige al menos un modelo principal.');
  if (chain.length > MAX_MODEL_BACKUPS + 1) fail(`Como mucho ${MAX_MODEL_BACKUPS} modelos de respaldo.`);
  const catalog = await loadOrganizationCatalog(ctx.organizationId);
  const seen = new Set<string>();
  for (const ref of chain) {
    const allowed = allowedModel(action, ref.model, ref.provider, catalog);
    if (!allowed || allowed.status === 'deprecated') fail(`El modelo ${ref.model} no está disponible para este uso.`);
    const key = `${ref.provider}::${ref.model}`;
    if (seen.has(key)) fail('No repitas el mismo modelo en la cadena.');
    seen.add(key);
  }
  await prisma.$transaction([
    prisma.organizationModelRoute.deleteMany({ where: { organizationId: ctx.organizationId, action } }),
    prisma.organizationModelRoute.createMany({ data: chain.map((ref, position) => ({ organizationId: ctx.organizationId, action, position, provider: ref.provider, model: ref.model })) }),
  ]);
}

/** Vuelve a la recomendación de Habiteka para un uso. */
export async function resetOrganizationModelUse(ctx: OrgContext, action: ModelAction): Promise<void> {
  if (!canManageAiKeys(ctx)) fail('Solo el propietario o un administrador de la organización puede cambiar sus modelos.');
  await prisma.organizationModelRoute.deleteMany({ where: { organizationId: ctx.organizationId, action } });
}
