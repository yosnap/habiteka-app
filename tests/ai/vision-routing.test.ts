import { beforeEach, describe, expect, it, vi } from 'vitest';
const fixture = vi.hoisted(() => ({ chat: vi.fn(), record: vi.fn(), routes: [] as { provider: string; model: string; baseURL: null; fallbacks: string[] }[] }));
vi.mock('server-only', () => ({}));
vi.mock('@/server/ai/model-routing', () => ({ resolveRoutes: async () => fixture.routes }));
vi.mock('@/server/ai/provider-key-resolver', () => ({ resolveProviderKey: async () => 'test-key', resolveKieKey: async () => 'test-key' }));
vi.mock('@/server/ai/chat-vision-adapter', () => ({ OpenRouterChatVisionAdapter: class { chat = fixture.chat; } }));
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
describe('ruta de revisión visual del render', () => {
  it('usa la ruta configurada compatible y registra el modelo efectivo', async () => {
    fixture.chat.mockResolvedValue({ content: '{}', usage: {} });
    const adapter = await getChatVisionAdapter({ organizationId: 'test' }, 'vision', { requiredProvider: 'openrouter' });
    expect(await adapter.chat(request)).toMatchObject({ execution: { provider: 'openrouter', model: 'anthropic/claude-sonnet-5' } });
    expect(fixture.chat).toHaveBeenCalledWith(expect.objectContaining({ model: 'anthropic/claude-sonnet-5', reasoning: { effort: 'low' } }));
  });
  it('no degrada la revisión a un proveedor ajeno si el auditor falla', async () => {
    fixture.chat.mockRejectedValue(new AiError('provider_down', 'No disponible'));
    const adapter = await getChatVisionAdapter({ organizationId: 'test' }, 'vision', { requiredProvider: 'openrouter' });
    await expect(adapter.chat(request)).rejects.toThrow('No disponible');
    expect(fixture.chat).toHaveBeenCalledTimes(1);
  });
  it('detecta la ausencia de una ruta de auditoría antes de generar una imagen', async () => {
    fixture.routes = fixture.routes.slice(0, 1);
    await expect(getChatVisionAdapter({ organizationId: 'test' }, 'vision', { requiredProvider: 'openrouter' })).rejects.toThrow('No hay ruta');
    expect(fixture.chat).not.toHaveBeenCalled();
  });
});
