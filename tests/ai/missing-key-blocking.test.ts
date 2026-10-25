import { beforeEach, describe, expect, it, vi } from 'vitest';
const fixture = vi.hoisted(() => ({ chat: vi.fn(), key: vi.fn(), outcome: vi.fn(), routes: [] as { provider: string; model: string; baseURL: null; fallbacks: string[] }[] }));
vi.mock('server-only', () => ({}));
vi.mock('@/server/ai/model-routing', () => ({ resolveRoutes: async () => fixture.routes }));
vi.mock('@/server/ai/provider-key-resolver', () => ({ resolveProviderKey: fixture.key, resolveKieKey: (scope: unknown) => fixture.key(scope, 'kie') }));
vi.mock('@/server/ai/chat-vision-adapter', async (importOriginal) => ({ ...await importOriginal<object>(), OpenRouterChatVisionAdapter: class { chat = fixture.chat; } }));
vi.mock('@/server/ai/image/providers/kie-image', () => ({ KieImageProvider: class { generate = vi.fn(); } }));
vi.mock('@/server/storage/s3-storage-adapter', () => ({ getStorageAdapter: () => undefined }));
vi.mock('@/server/analytics/ai-cost-recorder', () => ({ recordAiAttempt: vi.fn(), aiErrorCode: () => 'missing_key' }));
vi.mock('@/server/ai/guard/spend-guard', () => ({ assertCanSpend: vi.fn(), recordOutcome: fixture.outcome }));
vi.mock('@/server/privacy/jurisdiction-allowlist', () => ({ enforceModelJurisdiction: vi.fn() }));
vi.mock('@/server/ai/model-catalog', () => ({ allowedModel: () => undefined }));
import { AiError, getChatVisionAdapter, getImageAdapterForAction } from '@/server/ai';
import { aiError } from '@/server/ai/errors';

const ctx = { organizationId: 'org-a', userId: 'user-a' };
const request = { model: '', messages: [] };
const missing = (provider: string) => aiError('missing_key', `Tu organización no tiene clave de ${provider}.`);
beforeEach(() => {
  vi.resetAllMocks();
  fixture.routes = [
    { provider: 'openrouter', model: 'anthropic/claude-sonnet-5', baseURL: null, fallbacks: [] },
    { provider: 'openai', model: 'gpt-5', baseURL: null, fallbacks: [] },
  ];
});

describe('bloqueo de la generación sin clave de la organización', () => {
  it('resuelve cada clave con la organización y el usuario del contexto', async () => {
    fixture.key.mockResolvedValue('clave');
    fixture.chat.mockResolvedValue({ content: '{}', usage: {} });
    await (await getChatVisionAdapter(ctx, 'chat')).chat(request);
    expect(fixture.key).toHaveBeenCalledWith(ctx, 'openrouter');
  });

  it('si falta la clave del primario, responde el respaldo cuya clave sí tiene', async () => {
    fixture.key.mockImplementation(async (_scope, provider: string) => { if (provider === 'openrouter') throw missing('OpenRouter'); return 'clave'; });
    fixture.chat.mockResolvedValue({ content: '{}', usage: {} });
    await expect((await getChatVisionAdapter(ctx, 'chat')).chat(request)).resolves.toMatchObject({ execution: { provider: 'openai' } });
  });

  it('sin ninguna clave bloquea con un solo mensaje que dice qué claves añadir y dónde', async () => {
    fixture.key.mockImplementation(async (_scope, provider: string) => { throw missing(provider); });
    const error = await (await getChatVisionAdapter(ctx, 'chat')).chat(request).catch((caught) => caught);
    expect(error).toBeInstanceOf(AiError);
    expect(error.kind).toBe('missing_key');
    expect(error.message).toBe('Para usar esta función, tu organización necesita su propia clave de OpenRouter o OpenAI. Añádela en Mi perfil › Claves de IA (/perfil/claves-ia).');
    expect(fixture.chat).not.toHaveBeenCalled();
  });

  it('una clave ausente no abre el cortacircuitos de la organización', async () => {
    fixture.key.mockImplementation(async (_scope, provider: string) => { throw missing(provider); });
    await (await getChatVisionAdapter(ctx, 'chat')).chat(request).catch(() => undefined);
    expect(fixture.outcome).not.toHaveBeenCalled();
  });

  it('también bloquea las imágenes sin clave del proveedor de imagen', async () => {
    fixture.routes = [{ provider: 'kie', model: 'nano-banana', baseURL: null, fallbacks: [] }];
    fixture.key.mockImplementation(async (_scope, provider: string) => { throw missing(provider); });
    const image = await getImageAdapterForAction(ctx, 'render3d');
    await expect(image.generate({ prompt: 'salón' } as never)).rejects.toMatchObject({ kind: 'missing_key', message: expect.stringMatching(/clave de KIE.*Mi perfil › Claves de IA/) });
  });

  it('un fallo real del proveedor sigue mostrándose tal cual', async () => {
    fixture.key.mockResolvedValue('clave');
    fixture.chat.mockRejectedValue(new AiError('refusal', 'El modelo se niega'));
    await expect((await getChatVisionAdapter(ctx, 'chat')).chat(request)).rejects.toThrow('El modelo se niega');
  });
});
