import type { ModelAction } from '@/generated/prisma/enums';
import { prisma } from '@/server/db/prisma';

/**
 * Proveedores de IA compatibles con OpenAI que cada organización añade desde Mi perfil (APIMart, NodeClub.ai…) y los
 * modelos que habilita, de esos proveedores o de los integrados. Se leen por organización en cada resolución: el
 * catálogo de una nunca se mezcla con el de otra.
 */
export interface CustomProvider { id: string; label: string; baseUrl: string }
export interface CustomModel { providerId: string; model: string; label: string; actions: ModelAction[]; priceUsdPerUnit: number }

/** Proveedores que el panel ofrece ya rellenos: basta con pegar la clave. */
export const CUSTOM_PROVIDER_PRESETS: readonly CustomProvider[] = [
  { id: 'apimart', label: 'APIMart', baseUrl: 'https://api.apimart.ai/v1' },
];
/** Usos que atiende un proveedor propio: los de texto y visión. Las imágenes tienen cada una su propia API. */
export const CUSTOM_MODEL_ACTIONS: readonly ModelAction[] = ['vision', 'chat', 'plano2d', 'memoria'];
/** Proveedores con integración propia: un proveedor añadido no puede llamarse igual. */
export const BUILT_IN_PROVIDERS: readonly string[] = ['openrouter', 'kie', 'nan', 'openai', 'typesafe'];
/** Integrados que admiten modelos de texto y visión habilitados desde el panel, con la URL de su API. */
export const BUILT_IN_MODEL_PROVIDERS: Readonly<Record<string, CustomProvider>> = {
  openrouter: { id: 'openrouter', label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1' },
  nan: { id: 'nan', label: 'NaN', baseUrl: 'https://api.nan.builders/v1' },
  openai: { id: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1' },
  // Solo sus modelos Claude, con el formato de mensajes de Anthropic; las imágenes de KIE van por su propio adaptador.
  kie: { id: 'kie', label: 'KIE', baseUrl: 'https://api.kie.ai/claude' },
};
/** Modelos Claude de KIE según su documentación (docs.kie.ai/market/claude): KIE no publica una lista por API. */
export const KIE_CHAT_MODELS: readonly string[] = [
  'claude-sonnet-5', 'claude-sonnet-5-5', 'claude-opus-5', 'claude-opus-5-5', 'claude-fable-5', 'claude-haiku-4-5',
  'claude-sonnet-4-6', 'claude-sonnet-4-5', 'claude-opus-4-8', 'claude-opus-4-7', 'claude-opus-4-6', 'claude-opus-4-5',
];
/** En KIE, los modelos de texto son los Claude; el resto de sus modelos son de imagen. */
export const isKieChatModel = (model: string) => model.startsWith('claude-');

/** Catálogo propio de una organización: sus proveedores compatibles y los modelos que ha habilitado. */
export interface OrganizationCatalog { providers: Map<string, CustomProvider>; models: CustomModel[] }

export const EMPTY_CATALOG: OrganizationCatalog = { providers: new Map(), models: [] };

export async function loadOrganizationCatalog(organizationId: string): Promise<OrganizationCatalog> {
  try {
    const [rows, models] = await Promise.all([
      prisma.aiCustomProvider.findMany({ where: { organizationId }, orderBy: { label: 'asc' } }),
      prisma.aiCustomModel.findMany({ where: { organizationId }, orderBy: { label: 'asc' } }),
    ]);
    return {
      providers: new Map(rows.map(({ id, label, baseUrl }) => [id, { id, label, baseUrl }])),
      models: models.map(({ providerId, model, label, actions, priceUsdPerUnit }) => ({ providerId, model, label, actions, priceUsdPerUnit })),
    };
  } catch {
    // Sin la tabla (base sin migrar) o con la base caída, la organización sigue con el catálogo de Habiteka.
    return EMPTY_CATALOG;
  }
}

/** Nombre legible de un proveedor para los mensajes: el integrado, el de la organización o su id en mayúsculas. */
export function providerLabel(id: string, catalog: OrganizationCatalog = EMPTY_CATALOG): string {
  return BUILT_IN_MODEL_PROVIDERS[id]?.label ?? catalog.providers.get(id)?.label ?? id.toUpperCase();
}

/** Modelos habilitados por la organización para un uso (de sus proveedores o de los integrados), con el proveedor. */
export function customModels(action: ModelAction, catalog: OrganizationCatalog): (CustomModel & { providerLabel: string; builtIn: boolean })[] {
  return catalog.models.flatMap((model) => {
    const provider = BUILT_IN_MODEL_PROVIDERS[model.providerId] ?? catalog.providers.get(model.providerId);
    return model.actions.includes(action) && provider
      ? [{ ...model, providerLabel: provider.label, builtIn: !!BUILT_IN_MODEL_PROVIDERS[model.providerId] }] : [];
  });
}
