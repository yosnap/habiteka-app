import { beforeEach, describe, expect, it, vi } from 'vitest';
const fixture = vi.hoisted(() => ({ chat: vi.fn(), record: vi.fn(), routes: [] as { provider: string; model: string; baseURL: null; fallbacks: string[] }[] }));
vi.mock('server-only', () => ({}));
vi.mock('@/server/ai/model-routing', () => ({ resolveRoutes: async () => fixture.routes }));
vi.mock('@/server/ai/provider-key-resolver', () => ({ resolveProviderKey: async () => 'test-key', resolveKieKey: async () => 'test-key' }));
vi.mock('@/server/ai/chat-vision-adapter', async (importOriginal) => ({ ...await importOriginal<object>(), OpenRouterChatVisionAdapter: class { chat = fixture.chat; } }));
vi.mock('@/server/analytics/ai-cost-recorder', () => ({ recordAiAttempt: fixture.record, aiErrorCode: () => 'provider_down' }));
vi.mock('@/server/ai/guard/spend-guard', () => ({ assertCanSpend: vi.fn(), recordOutcome: vi.fn() }));
vi.mock('@/server/privacy/jurisdiction-allowlist', () => ({ enforceModelJurisdiction: vi.fn() }));
import { AiError, getChatVisionAdapter } from '@/server/ai';

beforeEach(() => {
  vi.clearAllMocks();
  fixture.routes = [
    { provider: 'nan', model: 'gemma4', baseURL: null, fallbacks: [] },
    { provider: 'openrouter', model: 'anthropic/claude-sonnet-5', baseURL: null, fallbacks: [] },
  ];
});
const request = { model: '', messages: [], reasoning: { effort: 'low' as const } };
describe('rutas de análisis visual (lectura de planos, Amueblar y revisión de renders)', () => {
  it('usa el primario configurado y registra el modelo efectivo', async () => {
    fixture.chat.mockResolvedValue({ content: '{}', usage: {} });
    const adapter = await getChatVisionAdapter({ organizationId: 'test' }, 'vision');
    expect(await adapter.chat(request)).toMatchObject({ execution: { provider: 'nan', model: 'gemma4' } });
    expect(fixture.chat).toHaveBeenCalledWith(expect.objectContaining({ model: 'gemma4', reasoning: { effort: 'low' } }));
  });
  it('si el primario está caído responde el respaldo configurado', async () => {
    fixture.chat.mockRejectedValueOnce(new AiError('provider_down', 'No disponible')).mockResolvedValueOnce({ content: '{}', usage: {} });
    const adapter = await getChatVisionAdapter({ organizationId: 'test' }, 'vision');
    expect(await adapter.chat(request)).toMatchObject({ execution: { provider: 'openrouter', model: 'anthropic/claude-sonnet-5' } });
    expect(fixture.chat).toHaveBeenCalledTimes(2);
  });
  it('respeta el orden configurado: el primario primero, aunque sea de otro proveedor', async () => {
    fixture.chat.mockResolvedValue({ content: '{}', usage: {} });
    const adapter = await getChatVisionAdapter({ organizationId: 'test' }, 'vision');
    expect(await adapter.chat(request)).toMatchObject({ execution: { provider: 'nan', model: 'gemma4' } });
  });
  it('si el primario no devuelve el JSON completo responde el respaldo', async () => {
    fixture.chat.mockRejectedValueOnce(new AiError('schema', 'El modelo agotó el límite de respuesta')).mockResolvedValueOnce({ content: '{}', usage: {} });
    const adapter = await getChatVisionAdapter({ organizationId: 'test' }, 'vision');
    expect(await adapter.chat({ ...request, responseSchema: { name: 'x', schema: {} } } as never)).toMatchObject({ execution: { provider: 'openrouter' } });
  });
  it('si fallan todos, el error dice qué le pasó a cada modelo', async () => {
    fixture.chat.mockRejectedValueOnce(new AiError('schema', 'El modelo agotó el límite de respuesta'))
      .mockRejectedValueOnce(new AiError('provider_down', 'El proveedor de IA se ha quedado sin saldo.'));
    const adapter = await getChatVisionAdapter({ organizationId: 'test' }, 'vision');
    const error = await adapter.chat({ ...request, responseSchema: { name: 'x', schema: {} } } as never).catch((cause) => cause);
    expect(error.message).toContain('nan · gemma4: El modelo agotó el límite');
    expect(error.message).toContain('openrouter · anthropic/claude-sonnet-5: El proveedor de IA se ha quedado sin saldo');
  });
  it('Claude de KIE entra en análisis visual con su formato; los modelos de imagen de KIE no', async () => {
    fixture.routes = [
      { provider: 'kie', model: 'flux-2/pro-image-to-image', baseURL: null, fallbacks: [] },
      { provider: 'kie', model: 'claude-sonnet-5', baseURL: 'https://api.kie.ai/claude', fallbacks: [] } as never,
    ];
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ content: [{ type: 'text', text: 'ok' }], usage: { input_tokens: 1, output_tokens: 1 } }), { status: 200 }));
    const adapter = await getChatVisionAdapter({ organizationId: 'test' }, 'vision');
    expect(await adapter.chat(request)).toMatchObject({ content: 'ok', execution: { provider: 'kie', model: 'claude-sonnet-5' } });
    expect(fetchMock.mock.calls[0]![0]).toBe('https://api.kie.ai/claude/v1/messages');
    expect(fixture.chat).not.toHaveBeenCalled();
    fetchMock.mockRestore();
  });
  it('sin ninguna ruta de texto o visión avisa antes de generar una imagen', async () => {
    fixture.routes = [{ provider: 'kie', model: 'flux', baseURL: null, fallbacks: [] }];
    await expect(getChatVisionAdapter({ organizationId: 'test' }, 'vision')).rejects.toThrow('No hay ruta');
    expect(fixture.chat).not.toHaveBeenCalled();
  });
});
