/**
 * Proveedores compatibles con OpenAI añadidos desde el panel (APIMart, NodeClub.ai…): su clave solo viaja a su URL,
 * sus modelos respetan el techo de precio de cada uso y se pueden elegir en las rutas como cualquier otro.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
vi.mock('server-only', () => ({}));
// La lista de modelos se pide con la clave del proveedor; aquí no hay claves reales.
vi.mock('@/server/ai/provider-key-resolver', () => ({ resolveProviderKey: async () => 'k', resolveKieKey: async () => 'k' }));
import { prisma } from '@/server/db/prisma';
import { deleteCustomModel, deleteCustomProvider, listBuiltInModelProviders, listCustomProviders, listProviderModels, saveCustomModel, saveCustomProvider, validBaseUrl } from '@/server/admin/config/custom-provider-ops';
import { replaceModelConfigs } from '@/server/admin/config/model-config-ops';
import { resolveRoutes } from '@/server/ai/model-routing';
import { invalidateCustomRegistry, loadCustomRegistry } from '@/server/ai/custom-ai-providers';
import { allowedModels } from '@/server/admin/config/model-allowlist';
import { chatAttemptCost } from '@/server/ai/cost/chat-attempt-cost';
import { clearProviderPricingCache } from '@/server/ai/provider-pricing';
import { resetDb, makeUser } from '../helpers/db';

const ADMIN = 'admin-1', KEY = 'sk-prueba-0123456789abcdef';

async function clean() {
  await prisma.aiModelRoute.deleteMany();
  await prisma.modelConfig.deleteMany();
  await prisma.aiCustomModel.deleteMany();
  await prisma.aiCustomProvider.deleteMany();
  await prisma.aiProviderCredential.deleteMany({ where: { provider: { in: ['apimart', 'nodeclub'] } } });
  invalidateCustomRegistry();
}

describe('modelos de OpenRouter, NaN y OpenAI habilitados desde el panel', () => {
  beforeEach(async () => { await resetDb(); await clean(); await makeUser(); });

  it('un modelo de OpenRouter habilitado aparece en su uso y uno de OpenAI enruta a la API de OpenAI', async () => {
    await saveCustomModel(ADMIN, { providerId: 'openrouter', model: 'qwen/qwen3-vl-235b', label: 'Qwen3 VL', actions: ['vision'], priceUsdPerUnit: 0.3 });
    await saveCustomModel(ADMIN, { providerId: 'openai', model: 'gpt-5.2', label: 'GPT-5.2', actions: ['vision'], priceUsdPerUnit: 1.25 });
    invalidateCustomRegistry();
    await loadCustomRegistry();
    expect(allowedModels('vision')).toContainEqual(expect.objectContaining({ id: 'qwen/qwen3-vl-235b', provider: 'openrouter', label: 'Qwen3 VL' }));
    await replaceModelConfigs(ADMIN, [{ action: 'vision', primaryModel: 'gpt-5.2', provider: 'openai', enabled: true, backups: [{ model: 'qwen/qwen3-vl-235b', provider: 'openrouter' }] }]);
    expect(await resolveRoutes('vision')).toEqual([
      expect.objectContaining({ provider: 'openai', model: 'gpt-5.2', baseURL: 'https://api.openai.com/v1' }),
      expect.objectContaining({ provider: 'openrouter', model: 'qwen/qwen3-vl-235b' }),
    ]);
    const openRouter = (await listBuiltInModelProviders()).find((provider) => provider.id === 'openrouter')!;
    expect(openRouter.models.map((model) => model.model)).toEqual(['qwen/qwen3-vl-235b']);
    expect(openRouter.included.some((model) => model.model === 'anthropic/claude-sonnet-5' && model.actions.includes('vision'))).toBe(true);
  });

  it('Sonnet 5 de KIE se habilita para análisis visual y enruta a su API de Claude; un modelo de imagen de KIE no', async () => {
    clearProviderPricingCache();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: { pages: 1, records: [
      { modelDescription: 'claude-sonnet-5, chat, Input', usdPrice: '0.850' }, { modelDescription: 'gpt-6-1-sol, chat, Input', usdPrice: '0.6' },
    ] } }), { status: 200 }));
    // La lista de KIE sale de su API de precios: solo los Claude, con su precio de entrada.
    expect((await listProviderModels('kie')).models).toEqual([{ id: 'claude-sonnet-5', vision: true, priceUsdPerMillion: 0.85 }]);
    fetchMock.mockRestore();
    await expect(saveCustomModel(ADMIN, { providerId: 'kie', model: 'nano-banana-pro', label: 'x', actions: ['vision'], priceUsdPerUnit: 1 })).rejects.toThrow(/Claude/);
    await saveCustomModel(ADMIN, { providerId: 'kie', model: 'claude-sonnet-5', label: 'Claude Sonnet 5', actions: ['vision', 'chat'], priceUsdPerUnit: 2 });
    invalidateCustomRegistry();
    await loadCustomRegistry();
    expect(allowedModels('vision')).toContainEqual(expect.objectContaining({ id: 'claude-sonnet-5', provider: 'kie', label: 'Claude Sonnet 5' }));
    await replaceModelConfigs(ADMIN, [{ action: 'vision', primaryModel: 'claude-sonnet-5', provider: 'kie', enabled: true, backups: [] }]);
    expect(await resolveRoutes('vision')).toEqual([expect.objectContaining({ provider: 'kie', model: 'claude-sonnet-5', baseURL: 'https://api.kie.ai/claude' })]);
  });

  it('no se habilita otra vez un modelo que ya viene incluido para ese uso', async () => {
    await expect(saveCustomModel(ADMIN, { providerId: 'openrouter', model: 'anthropic/claude-sonnet-5', label: 'Sonnet', actions: ['vision'], priceUsdPerUnit: 2 }))
      .rejects.toThrow(/incluido/);
  });

  it('la lista de APIMart se completa con los precios de su API pública', async () => {
    clearProviderPricingCache();
    await saveCustomProvider(ADMIN, { id: 'apimart', label: 'APIMart', baseUrl: '', apiKey: KEY, enabled: true });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => new Response(JSON.stringify(String(url).includes('/api/pricing')
      ? { data: { models: { llm: [{ id: 'claude-sonnet-5', input_price_per_1m: 2, input_price_per_1m_after_discount: 1.6 }] } } }
      : { data: [{ id: 'claude-sonnet-5' }, { id: 'sin-precio' }] }), { status: 200 }));
    try {
      expect((await listProviderModels('apimart')).models).toEqual([{ id: 'claude-sonnet-5', priceUsdPerMillion: 1.6 }, { id: 'sin-precio' }]);
    } finally { fetchMock.mockRestore(); }
  });

  it('la lista de OpenRouter trae el precio de entrada por 1M tokens y si admite imágenes', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: [
      { id: 'b/texto', pricing: { prompt: '0.0000001' }, architecture: { input_modalities: ['text'] } },
      { id: 'a/vision', pricing: { prompt: '0.000003' }, architecture: { input_modalities: ['text', 'image'] } },
    ] }), { status: 200 }));
    try {
      expect((await listProviderModels('openrouter')).models).toEqual([{ id: 'a/vision', priceUsdPerMillion: 3, vision: true }, { id: 'b/texto', priceUsdPerMillion: 0.1, vision: false }]);
      expect(fetchMock.mock.calls[0]![0]).toBe('https://openrouter.ai/api/v1/models');
    } finally { fetchMock.mockRestore(); }
  });
});

describe('URL base de un proveedor propio', () => {
  it('exige https y un servidor público, sin credenciales ni parámetros', () => {
    expect(validBaseUrl('https://api.nodeclub.ai/v1/')).toBe('https://api.nodeclub.ai/v1');
    for (const url of ['http://api.nodeclub.ai/v1', 'https://localhost:8080/v1', 'https://192.168.1.10/v1', 'https://user:pw@api.x.com/v1', 'https://api.x.com/v1?k=1', 'no-es-url'])
      expect(() => validBaseUrl(url), url).toThrow();
  });
});

describe('proveedores propios en el panel y en las rutas', () => {
  beforeEach(async () => { await resetDb(); await clean(); await makeUser(); });

  it('APIMart aparece preconfigurado y, con su clave y un modelo de visión, se puede usar como ruta con su URL', async () => {
    expect((await listCustomProviders()).find((item) => item.id === 'apimart')).toMatchObject({ preset: true, saved: false, baseUrl: 'https://api.apimart.ai/v1' });
    await saveCustomProvider(ADMIN, { id: 'apimart', label: 'APIMart', baseUrl: 'https://otra.url/v1', apiKey: KEY, enabled: true });
    // Un preconfigurado conserva su URL aunque se envíe otra.
    expect((await prisma.aiCustomProvider.findUnique({ where: { id: 'apimart' } }))?.baseUrl).toBe('https://api.apimart.ai/v1');
    await saveCustomModel(ADMIN, { providerId: 'apimart', model: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5', actions: ['vision', 'chat'], priceUsdPerUnit: 3 });
    await replaceModelConfigs(ADMIN, [{ action: 'vision', primaryModel: 'claude-sonnet-4-5', provider: 'apimart', enabled: true, backups: [] }]);
    expect(await resolveRoutes('vision')).toEqual([expect.objectContaining({ model: 'claude-sonnet-4-5', provider: 'apimart', baseURL: 'https://api.apimart.ai/v1' })]);
    // En uso no se puede quitar ni el modelo ni el proveedor.
    await expect(deleteCustomModel(ADMIN, 'apimart', 'claude-sonnet-4-5')).rejects.toThrow(/vision/);
    await expect(deleteCustomProvider(ADMIN, 'apimart')).rejects.toThrow(/vision/);
  });

  it('un proveedor nuevo necesita clave, y cambiar su URL exige pegarla otra vez', async () => {
    await expect(saveCustomProvider(ADMIN, { label: 'NodeClub.ai', baseUrl: 'https://api.nodeclub.ai/v1', apiKey: '', enabled: true })).rejects.toThrow(/API key/);
    const id = await saveCustomProvider(ADMIN, { label: 'NodeClub.ai', baseUrl: 'https://api.nodeclub.ai/v1', apiKey: KEY, enabled: true });
    expect(id).toBe('nodeclub');
    await expect(saveCustomProvider(ADMIN, { id, label: 'NodeClub.ai', baseUrl: 'https://otro.servidor.com/v1', apiKey: '', enabled: true })).rejects.toThrow(/API key/);
    await saveCustomProvider(ADMIN, { id, label: 'NodeClub.ai', baseUrl: 'https://api.nodeclub.ai/v1', apiKey: '', enabled: false });
    expect((await prisma.aiProviderCredential.findUnique({ where: { provider: 'nodeclub' } }))?.enabled).toBe(false);
    await expect(saveCustomProvider(ADMIN, { label: 'OpenRouter', baseUrl: 'https://x.com/v1', apiKey: KEY, enabled: true })).rejects.toThrow();
  });

  it('un modelo por encima del techo de precio del uso o sin usos se rechaza', async () => {
    await saveCustomProvider(ADMIN, { id: 'apimart', label: 'APIMart', baseUrl: '', apiKey: KEY, enabled: true });
    await expect(saveCustomModel(ADMIN, { providerId: 'apimart', model: 'caro', label: 'Caro', actions: ['vision'], priceUsdPerUnit: 50 })).rejects.toThrow(/techo/);
    await expect(saveCustomModel(ADMIN, { providerId: 'apimart', model: 'x', label: 'X', actions: [], priceUsdPerUnit: 1 })).rejects.toThrow(/uso/);
    await expect(saveCustomModel(ADMIN, { providerId: 'apimart', model: 'img', label: 'Img', actions: ['render3d'], priceUsdPerUnit: 0.05 })).rejects.toThrow(/uso/);
    await expect(saveCustomModel(ADMIN, { providerId: 'apimart', model: 'x', label: 'X', actions: ['vision'], priceUsdPerUnit: -1 })).rejects.toThrow(/precio/);
  });

  it('un modelo incluido en la suscripción se habilita con precio 0 y su coste estimado es 0', async () => {
    await saveCustomProvider(ADMIN, { label: 'NodeClub.ai', baseUrl: 'https://api.nodeclub.ai/v1', apiKey: KEY, enabled: true });
    await saveCustomModel(ADMIN, { providerId: 'nodeclub', model: 'qwen3.8-27b', label: 'Qwen 3.8 27B', actions: ['vision'], priceUsdPerUnit: 0 });
    invalidateCustomRegistry();
    await loadCustomRegistry();
    expect(allowedModels('vision')).toContainEqual(expect.objectContaining({ id: 'qwen3.8-27b', provider: 'nodeclub', label: 'NodeClub.ai · Qwen 3.8 27B' }));
    expect(chatAttemptCost({ promptTokens: 1000, completionTokens: 500 }, 0)).toEqual({ costUsd: 0, costType: 'estimated' });
  });
});
