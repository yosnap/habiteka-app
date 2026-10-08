/**
 * Proveedores de IA compatibles con OpenAI que añade el administrador (APIMart, NodeClub.ai…) y sus modelos de texto y
 * visión. La clave se guarda cifrada como la de los proveedores integrados y solo viaja a la URL registrada, que debe
 * ser https y pública; cambiar la URL de un proveedor exige pegar de nuevo la clave, para que nadie pueda desviar una
 * clave ya guardada a otro servidor. Cada cambio queda auditado y la IA lo usa en la siguiente llamada.
 */
import type { ModelAction } from '@/generated/prisma/enums';
import { prisma } from '@/server/db/prisma';
import { invalidateModelConfig } from '@/server/ai';
import { BUILT_IN_MODEL_PROVIDERS, BUILT_IN_PROVIDERS, CUSTOM_MODEL_ACTIONS, CUSTOM_PROVIDER_PRESETS, invalidateCustomRegistry, isKieChatModel, KIE_CHAT_MODELS } from '@/server/ai/custom-ai-providers';
import { resolveProviderKey } from '@/server/ai/provider-key-resolver';
import { apimartPrices, kieChatPrices } from '@/server/ai/provider-pricing';
import { writeAudit } from '../audit';
import { configError } from './config-errors';
import { getProviderStatus, updateProvider } from './ai-provider-ops';
import { allowedModels, includedModel, PRICE_CEILING } from './model-allowlist';

export interface EnabledModelView { model: string; label: string; actions: ModelAction[]; priceUsdPerUnit: number }
export interface CustomProviderView {
  id: string; label: string; baseUrl: string; preset: boolean; saved: boolean;
  configured: boolean; enabled: boolean; keyHint: string | null;
  models: EnabledModelView[];
}
/** OpenRouter, NaN u OpenAI: los modelos que vienen de serie (`included`) y los habilitados desde el panel. */
export interface BuiltInModelProviderView {
  id: string; label: string; configured: boolean; models: EnabledModelView[];
  included: { model: string; label: string; actions: ModelAction[] }[];
}
/** Modelo que publica el proveedor; precio de entrada y entrada de imágenes solo si los informa (OpenRouter). */
export interface ProviderCatalogModel { id: string; priceUsdPerMillion?: number; vision?: boolean }

/** Proveedores propios guardados y los preconfigurados que aún no se han dado de alta. */
export async function listCustomProviders(): Promise<CustomProviderView[]> {
  const [rows, models] = await Promise.all([prisma.aiCustomProvider.findMany({ orderBy: { label: 'asc' } }), prisma.aiCustomModel.findMany({ orderBy: { label: 'asc' } })]);
  const presets = CUSTOM_PROVIDER_PRESETS.filter((preset) => !rows.some((row) => row.id === preset.id));
  const views = [...rows.map((row) => ({ ...row, models: models.filter((model) => model.providerId === row.id), saved: true })),
    ...presets.map((preset) => ({ ...preset, models: [], saved: false }))];
  return Promise.all(views.map(async (view) => {
    const status = await getProviderStatus(view.id);
    return { id: view.id, label: view.label, baseUrl: view.baseUrl, saved: view.saved, preset: CUSTOM_PROVIDER_PRESETS.some((preset) => preset.id === view.id),
      configured: status.configured, enabled: status.enabled, keyHint: status.keyHint,
      models: view.models.map(({ model, label, actions, priceUsdPerUnit }) => ({ model, label, actions, priceUsdPerUnit })) };
  }));
}

/** URL base de una API compatible con OpenAI: https, sin credenciales ni parámetros y de un servidor público. */
export function validBaseUrl(raw: string): string {
  let url: URL;
  try { url = new URL(raw.trim()); } catch { throw configError('La URL base no es válida (ejemplo: https://api.proveedor.com/v1)'); }
  if (url.protocol !== 'https:') throw configError('La URL base debe empezar por https://');
  if (url.username || url.password || url.search || url.hash) throw configError('La URL base no puede llevar usuario, contraseña ni parámetros');
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') || host.startsWith('[') || /^(127|10|0)\./.test(host)
    || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host) || /^169\.254\./.test(host)) {
    throw configError('La URL base debe ser la de un servidor público, no una dirección local o privada');
  }
  return url.toString().replace(/\/+$/, '');
}

function slugFor(label: string): string {
  return label.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\.(ai|com|io|dev)$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32);
}

export async function saveCustomProvider(actorId: string, input: { id?: string; label: string; baseUrl: string; apiKey: string; enabled: boolean }) {
  const label = input.label.trim();
  if (label.length < 2 || label.length > 40) throw configError('El nombre del proveedor debe tener entre 2 y 40 caracteres');
  const preset = CUSTOM_PROVIDER_PRESETS.find((item) => item.id === input.id);
  const id = input.id ?? slugFor(label);
  if (!/^[a-z0-9-]{2,32}$/.test(id) || BUILT_IN_PROVIDERS.includes(id)) throw configError(`El nombre «${label}» no sirve como proveedor: elige otro`);
  // Un preconfigurado conserva su URL; los demás usan la que se escribe.
  const baseUrl = preset ? preset.baseUrl : validBaseUrl(input.baseUrl);
  const existing = await prisma.aiCustomProvider.findUnique({ where: { id } });
  if (!input.id && existing) throw configError(`Ya hay un proveedor llamado «${existing.label}»`);
  if (input.id && !existing && !preset) throw configError('Ese proveedor ya no existe');
  const apiKey = input.apiKey.trim(), credential = await prisma.aiProviderCredential.findUnique({ where: { provider: id } });
  // La clave solo viaja a la URL con la que se guardó: una URL nueva exige pegarla otra vez.
  if (!apiKey && (!credential || (existing && existing.baseUrl !== baseUrl))) throw configError('Pega la API key del proveedor');
  await prisma.aiCustomProvider.upsert({ where: { id }, create: { id, label, baseUrl }, update: { label, baseUrl } });
  if (apiKey) await updateProvider(actorId, id, { apiKey, enabled: input.enabled });
  else await prisma.aiProviderCredential.update({ where: { provider: id }, data: { enabled: input.enabled } });
  await writeAudit({ actorId, action: 'save_custom_ai_provider', targetType: 'ai_provider', targetId: id, meta: { label, baseUrl, enabled: input.enabled, keyChanged: !!apiKey } });
  invalidate();
  return id;
}

/** Usos en los que una ruta activa depende del proveedor (o de uno de sus modelos). */
async function routesUsing(provider: string, model?: string): Promise<string[]> {
  const routes = await prisma.aiModelRoute.findMany({ where: { provider, ...(model ? { model } : {}) }, select: { action: true } });
  return [...new Set(routes.map((route) => route.action))];
}

export async function deleteCustomProvider(actorId: string, id: string) {
  const used = await routesUsing(id);
  if (used.length) throw configError(`El proveedor se usa en: ${used.join(', ')}. Cambia esas rutas antes de borrarlo`);
  await prisma.$transaction([
    prisma.aiCustomModel.deleteMany({ where: { providerId: id } }),
    prisma.aiCustomProvider.deleteMany({ where: { id } }),
    prisma.aiProviderCredential.deleteMany({ where: { provider: id } }),
  ]);
  await writeAudit({ actorId, action: 'delete_custom_ai_provider', targetType: 'ai_provider', targetId: id, meta: {} });
  invalidate();
}

export async function listBuiltInModelProviders(): Promise<BuiltInModelProviderView[]> {
  const models = await prisma.aiCustomModel.findMany({ where: { providerId: { in: Object.keys(BUILT_IN_MODEL_PROVIDERS) } }, orderBy: { label: 'asc' } });
  return Promise.all(Object.values(BUILT_IN_MODEL_PROVIDERS).map(async ({ id, label }) => {
    const included = new Map<string, { model: string; label: string; actions: ModelAction[] }>();
    for (const action of CUSTOM_MODEL_ACTIONS) for (const item of allowedModels(action)) {
      if (item.provider !== id || !includedModel(action, item.id, id)) continue;
      const entry = included.get(item.id) ?? { model: item.id, label: item.label, actions: [] };
      entry.actions.push(action); included.set(item.id, entry);
    }
    return { id, label, configured: (await getProviderStatus(id)).configured, included: [...included.values()],
      models: models.filter((model) => model.providerId === id).map(({ model, label: name, actions, priceUsdPerUnit }) => ({ model, label: name, actions, priceUsdPerUnit })) };
  }));
}

/** Lista de modelos del proveedor; también comprueba la clave (no gasta tokens). */
export async function listProviderModels(id: string): Promise<{ models: ProviderCatalogModel[]; note?: string }> {
  if (id === 'kie') return kieCatalog();
  const provider = BUILT_IN_MODEL_PROVIDERS[id] ?? await prisma.aiCustomProvider.findUnique({ where: { id } });
  if (!provider) throw configError('Guarda el proveedor con su clave antes de probarlo');
  const apiKey = await resolveProviderKey(id);
  let response: Response;
  try {
    response = await fetch(`${provider.baseUrl}/models`, { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(15000), redirect: 'error' });
  } catch {
    throw configError('El proveedor no responde en esa URL. Revisa la URL base');
  }
  if (response.status === 401 || response.status === 403) throw configError('El proveedor rechaza la clave (401/403). Revisa la API key');
  if (!response.ok) throw configError(`El proveedor no publica la lista de modelos (${response.status}). La clave puede ser válida: añade el modelo escribiendo su id`);
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

export async function saveCustomModel(actorId: string, input: { providerId: string; model: string; label: string; actions: ModelAction[]; priceUsdPerUnit: number }) {
  const model = input.model.trim(), label = input.label.trim() || model;
  if (!model || model.length > 200) throw configError('Escribe el id del modelo tal como lo da el proveedor');
  if (label.length > 60) throw configError('El nombre del modelo es demasiado largo');
  const actions = [...new Set(input.actions)].filter((action) => CUSTOM_MODEL_ACTIONS.includes(action));
  if (!actions.length) throw configError('Elige al menos un uso: visión, asistente, planos o memoria');
  const price = input.priceUsdPerUnit;
  // 0 vale: un modelo incluido en una suscripción no cuesta por llamada.
  if (!Number.isFinite(price) || price < 0) throw configError('Indica el precio de entrada del modelo por 1M tokens (USD); 0 si es gratuito o va incluido en tu suscripción');
  const ceiling = Math.min(...actions.map((action) => PRICE_CEILING[action]));
  if (price > ceiling) throw configError(`Un modelo de ${price} USD por 1M tokens supera el techo de ${ceiling} USD de los usos elegidos`);
  if (!BUILT_IN_MODEL_PROVIDERS[input.providerId] && !await prisma.aiCustomProvider.findUnique({ where: { id: input.providerId } })) throw configError('Guarda antes el proveedor');
  if (input.providerId === 'kie' && !isKieChatModel(model)) throw configError('En KIE solo se pueden habilitar sus modelos Claude para estos usos (por ejemplo, claude-sonnet-5)');
  const included = actions.filter((action) => includedModel(action, model, input.providerId));
  if (included.length) throw configError(`Ese modelo ya viene incluido para: ${included.join(', ')}. Quita esos usos o elige otro modelo`);
  await prisma.aiCustomModel.upsert({
    where: { providerId_model: { providerId: input.providerId, model } },
    create: { providerId: input.providerId, model, label, actions, priceUsdPerUnit: price },
    update: { label, actions, priceUsdPerUnit: price },
  });
  await writeAudit({ actorId, action: 'save_custom_ai_model', targetType: 'ai_provider', targetId: input.providerId, meta: { model, label, actions, priceUsdPerUnit: price } });
  invalidate();
}

export async function deleteCustomModel(actorId: string, providerId: string, model: string) {
  const used = await routesUsing(providerId, model);
  if (used.length) throw configError(`El modelo se usa en: ${used.join(', ')}. Cambia esas rutas antes de quitarlo`);
  await prisma.aiCustomModel.deleteMany({ where: { providerId, model } });
  await writeAudit({ actorId, action: 'delete_custom_ai_model', targetType: 'ai_provider', targetId: providerId, meta: { model } });
  invalidate();
}

function invalidate() {
  invalidateCustomRegistry();
  invalidateModelConfig();
}
