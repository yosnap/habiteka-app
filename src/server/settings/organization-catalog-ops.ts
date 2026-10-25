import 'server-only';
/**
 * Catálogo de IA de cada organización: proveedores compatibles con OpenAI que añade (APIMart, NodeClub.ai…) y modelos
 * que habilita, de esos proveedores o de los integrados, con su precio. La clave de un proveedor compatible solo viaja
 * a la URL con la que se guardó: cambiar la URL exige pegarla de nuevo. Todo se lee y escribe en la organización de
 * la sesión y solo el propietario o un administrador lo cambia.
 */
import type { ModelAction } from '@/generated/prisma/enums';
import { prisma } from '@/server/db/prisma';
import { BUILT_IN_MODEL_PROVIDERS, BUILT_IN_PROVIDERS, CUSTOM_MODEL_ACTIONS, CUSTOM_PROVIDER_PRESETS, isKieChatModel, KIE_CHAT_MODELS } from '@/server/ai/custom-ai-providers';
import { apimartPrices, kieChatPrices } from '@/server/ai/provider-pricing';
import { allowedModels, includedModel } from '@/server/ai/model-catalog';
import { fail } from '@/server/errors/run-action';
import type { OrgContext } from '@/server/auth/org-context';
import { canManageAiKeys, readOrganizationKey, sealOrganizationKey } from './organization-ai-keys';

export interface EnabledModelView { model: string; label: string; actions: ModelAction[]; priceUsdPerUnit: number }
export interface ProviderModelsView {
  provider: string;
  /** Modelos que ya trae el catálogo de Habiteka para ese proveedor (solo integrados). */
  included: { model: string; label: string; actions: ModelAction[] }[];
  models: EnabledModelView[];
}
/** Modelo que publica el proveedor; precio de entrada y entrada de imágenes solo si los informa (OpenRouter). */
export interface ProviderCatalogModel { id: string; priceUsdPerMillion?: number; vision?: boolean }

function assertCanManage(ctx: OrgContext): void {
  if (!canManageAiKeys(ctx)) fail('Solo el propietario o un administrador de la organización puede cambiar su catálogo de IA.');
}

/** URL base de una API compatible con OpenAI: https, sin credenciales ni parámetros y de un servidor público. */
export function validBaseUrl(raw: string): string {
  let url: URL;
  try { url = new URL(raw.trim()); } catch { fail('La URL base no es válida (ejemplo: https://api.proveedor.com/v1).'); }
  if (url.protocol !== 'https:') fail('La URL base debe empezar por https://');
  if (url.username || url.password || url.search || url.hash) fail('La URL base no puede llevar usuario, contraseña ni parámetros.');
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') || host.startsWith('[') || /^(127|10|0)\./.test(host)
    || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host) || /^169\.254\./.test(host)) {
    fail('La URL base debe ser la de un servidor público, no una dirección local o privada.');
  }
  return url.toString().replace(/\/+$/, '');
}

function slugFor(label: string): string {
  return label.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\.(ai|com|io|dev)$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32);
}

/** Modelos incluidos y habilitados de cada proveedor de la organización (integrados y compatibles). */
export async function listProviderModelViews(ctx: OrgContext, providers: string[]): Promise<ProviderModelsView[]> {
  const rows = await prisma.aiCustomModel.findMany({ where: { organizationId: ctx.organizationId }, orderBy: { label: 'asc' } });
  return providers.map((provider) => {
    const included = new Map<string, { model: string; label: string; actions: ModelAction[] }>();
    for (const action of CUSTOM_MODEL_ACTIONS) for (const item of allowedModels(action)) {
      if (item.provider !== provider || !includedModel(action, item.id, provider)) continue;
      const entry = included.get(item.id) ?? { model: item.id, label: item.label, actions: [] };
      entry.actions.push(action); included.set(item.id, entry);
    }
    return { provider, included: [...included.values()], models: rows.filter((row) => row.providerId === provider)
      .map(({ model, label, actions, priceUsdPerUnit }) => ({ model, label, actions, priceUsdPerUnit })) };
  });
}

/** Alta o cambio de un proveedor compatible con su clave. Un preconfigurado (APIMart) conserva su URL. */
export async function saveCompatibleProvider(ctx: OrgContext, input: { id?: string; label: string; baseUrl: string; apiKey: string }): Promise<string> {
  assertCanManage(ctx);
  const label = input.label.trim();
  if (label.length < 2 || label.length > 40) fail('El nombre del proveedor debe tener entre 2 y 40 caracteres.');
  const preset = CUSTOM_PROVIDER_PRESETS.find((item) => item.id === input.id);
  const id = input.id ?? slugFor(label);
  if (!/^[a-z0-9-]{2,32}$/.test(id) || BUILT_IN_PROVIDERS.includes(id)) fail(`El nombre «${label}» no sirve como proveedor: elige otro.`);
  const baseUrl = preset ? preset.baseUrl : validBaseUrl(input.baseUrl);
  const where = { organizationId_id: { organizationId: ctx.organizationId, id } };
  const existing = await prisma.aiCustomProvider.findUnique({ where });
  if (!input.id && existing) fail(`Ya tienes un proveedor llamado «${existing.label}».`);
  if (input.id && !existing && !preset) fail('Ese proveedor ya no existe.');
  const apiKey = input.apiKey.trim();
  const hasKey = !!await prisma.organizationAiCredential.findUnique({ where: { organizationId_provider: { organizationId: ctx.organizationId, provider: id } } });
  // La clave solo viaja a la URL con la que se guardó: una URL nueva exige pegarla otra vez.
  if (!apiKey && (!hasKey || (existing && existing.baseUrl !== baseUrl))) fail('Pega la API key del proveedor.');
  await prisma.aiCustomProvider.upsert({ where, create: { organizationId: ctx.organizationId, id, label, baseUrl }, update: { label, baseUrl } });
  if (apiKey) await sealOrganizationKey(ctx, id, apiKey);
  return id;
}

/** Borra el proveedor compatible con su clave, sus modelos y las elecciones de modelos que lo usaban. */
export async function deleteCompatibleProvider(ctx: OrgContext, id: string): Promise<void> {
  assertCanManage(ctx);
  const organizationId = ctx.organizationId;
  await prisma.$transaction([
    prisma.organizationModelRoute.deleteMany({ where: { organizationId, provider: id } }),
    prisma.aiCustomModel.deleteMany({ where: { organizationId, providerId: id } }),
    prisma.aiCustomProvider.deleteMany({ where: { organizationId, id } }),
    prisma.organizationAiCredential.deleteMany({ where: { organizationId, provider: id } }),
  ]);
}

/** Lista de modelos que publica el proveedor, con la clave de la organización (no gasta tokens). */
export async function listProviderCatalog(ctx: OrgContext, id: string): Promise<{ models: ProviderCatalogModel[]; note?: string }> {
  if (id === 'kie') return kieCatalog();
  const provider = BUILT_IN_MODEL_PROVIDERS[id]
    ?? await prisma.aiCustomProvider.findUnique({ where: { organizationId_id: { organizationId: ctx.organizationId, id } } });
  if (!provider) fail('Guarda el proveedor con su clave antes de ver sus modelos.');
  const apiKey = await readOrganizationKey(ctx, id);
  let response: Response;
  try {
    response = await fetch(`${provider.baseUrl}/models`, { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(15000), redirect: 'error' });
  } catch {
    fail('El proveedor no responde en esa URL. Revisa la URL base.');
  }
  if (response.status === 401 || response.status === 403) fail('El proveedor rechaza la clave (401/403). Revisa la API key.');
  if (!response.ok) fail(`El proveedor no publica la lista de modelos (${response.status}). La clave puede ser válida: escribe el id del modelo a mano.`);
  type Listed = { id?: unknown; pricing?: { prompt?: unknown }; architecture?: { input_modalities?: unknown } };
  const body = await response.json().catch(() => null) as { data?: Listed[] } | Listed[] | null;
  const list = Array.isArray(body) ? body : body?.data ?? [];
  // APIMart publica sus precios aparte, en una API pública.
  const published = id === 'apimart' ? await apimartPrices() : new Map<string, number>();
  return { models: list.flatMap((item): ProviderCatalogModel[] => {
    if (typeof item?.id !== 'string') return [];
    // OpenRouter publica en la lista el precio por token y si el modelo acepta imágenes; los demás, solo el id.
    const perToken = Number(item.pricing?.prompt), modalities = item.architecture?.input_modalities;
    const priceUsdPerMillion = Number.isFinite(perToken) && perToken >= 0 ? Math.round(perToken * 1e6 * 1e4) / 1e4 : published.get(item.id);
    return [{ id: item.id, ...(priceUsdPerMillion !== undefined ? { priceUsdPerMillion } : {}),
      ...(Array.isArray(modalities) ? { vision: modalities.includes('image') } : {}) }];
  }).sort((a, b) => a.id.localeCompare(b.id)).slice(0, 1000) };
}

/** Modelos Claude de KIE con su precio, de su API de precios; sin ella, los de su documentación (todos con visión). */
async function kieCatalog(): Promise<{ models: ProviderCatalogModel[]; note: string }> {
  const prices = await kieChatPrices();
  const ids = [...prices.keys()].filter(isKieChatModel);
  const models = (ids.length ? ids : [...KIE_CHAT_MODELS]).sort().map((model) => ({ id: model, vision: true,
    ...(prices.has(model) ? { priceUsdPerMillion: prices.get(model)! } : {}) }));
  return { models, note: ids.length
    ? `Modelos Claude de KIE con el precio de entrada que publica (${models.length}). La clave se comprueba en la primera llamada.`
    : `KIE no ha devuelto sus precios: estos son sus modelos Claude según su documentación (${models.length}). Escribe el precio a mano.` };
}

export async function saveEnabledModel(ctx: OrgContext, input: { providerId: string; model: string; label: string; actions: ModelAction[]; priceUsdPerUnit: number }): Promise<void> {
  assertCanManage(ctx);
  const model = input.model.trim(), label = input.label.trim() || model;
  if (!model || model.length > 200) fail('Escribe el id del modelo tal como lo da el proveedor.');
  if (label.length > 60) fail('El nombre del modelo es demasiado largo.');
  const actions = [...new Set(input.actions)].filter((action) => CUSTOM_MODEL_ACTIONS.includes(action));
  if (!actions.length) fail('Elige al menos un uso: análisis visual, asistente, planos o memoria.');
  const price = input.priceUsdPerUnit;
  // 0 vale: un modelo incluido en una suscripción no cuesta por llamada.
  if (!Number.isFinite(price) || price < 0) fail('Indica el precio de entrada del modelo por 1M tokens (USD); 0 si es gratuito o va incluido en tu suscripción.');
  const organizationId = ctx.organizationId;
  if (!BUILT_IN_MODEL_PROVIDERS[input.providerId]
    && !await prisma.aiCustomProvider.findUnique({ where: { organizationId_id: { organizationId, id: input.providerId } } })) fail('Guarda antes el proveedor.');
  if (input.providerId === 'kie' && !isKieChatModel(model)) fail('En KIE solo se pueden habilitar sus modelos Claude para estos usos (por ejemplo, claude-sonnet-5).');
  const included = actions.filter((action) => includedModel(action, model, input.providerId));
  if (included.length) fail(`Ese modelo ya viene incluido en el catálogo de Habiteka para: ${included.join(', ')}. Quita esos usos o elige otro modelo.`);
  await prisma.aiCustomModel.upsert({
    where: { organizationId_providerId_model: { organizationId, providerId: input.providerId, model } },
    create: { organizationId, providerId: input.providerId, model, label, actions, priceUsdPerUnit: price },
    update: { label, actions, priceUsdPerUnit: price },
  });
}

/** Quita un modelo habilitado; las funciones que lo tenían elegido siguen con el resto de su cadena o la recomendación. */
export async function deleteEnabledModel(ctx: OrgContext, providerId: string, model: string): Promise<void> {
  assertCanManage(ctx);
  await prisma.aiCustomModel.deleteMany({ where: { organizationId: ctx.organizationId, providerId, model } });
}
