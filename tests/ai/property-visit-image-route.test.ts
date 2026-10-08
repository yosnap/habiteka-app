import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ generate: vi.fn(), price: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/server/ai/model-routing', () => ({ resolveRoutes: async () => [
  { provider: 'kie', model: 'primary' }, { provider: 'kie', model: 'backup' },
] }));
vi.mock('@/server/admin/config/model-allowlist', () => ({ allowedModel: m.price }));
vi.mock('@/server/ai/provider-key-resolver', () => ({ resolveProviderKey: async () => 'test', resolveKieKey: async () => 'test' }));
vi.mock('@/server/ai/image/providers/kie-image', () => ({ KieImageProvider: class { generate = m.generate; } }));
vi.mock('@/server/storage/s3-storage-adapter', () => ({ getStorageAdapter: () => undefined }));
vi.mock('@/server/analytics/ai-cost-recorder', () => ({ recordAiAttempt: vi.fn(), aiErrorCode: () => 'test' }));
vi.mock('@/server/ai/guard/spend-guard', () => ({ assertCanSpend: vi.fn(), recordOutcome: vi.fn() }));
vi.mock('@/server/privacy/jurisdiction-allowlist', () => ({ enforceModelJurisdiction: vi.fn() }));
import { getImageAdapterForAction, AiError } from '@/server/ai';
const ctx = { organizationId: 'org' }, confirmed = { provider: 'kie', model: 'primary', maxUsd: .15 };
beforeEach(() => { vi.resetAllMocks(); m.price.mockReturnValue({ priceUsdPerUnit: .15 }); });
describe('modelo presupuestado de un encuadre', () => {
  it('un fallo del modelo autorizado no activa el respaldo ni un segundo cobro', async () => {
    m.generate.mockRejectedValue(new AiError('provider_down', 'Sin respuesta'));
    const adapter = await getImageAdapterForAction(ctx, 'render3d', confirmed);
    await expect(adapter.generate({ prompt: 'accepted design' })).rejects.toThrow('Sin respuesta');
    expect(m.generate).toHaveBeenCalledOnce();
  });
  it('bloquea un cambio de precio o un modelo ausente antes de enviar', async () => {
    m.price.mockReturnValue({ priceUsdPerUnit: .20 });
    await expect(getImageAdapterForAction(ctx, 'render3d', confirmed)).rejects.toThrow('presupuesto');
    await expect(getImageAdapterForAction(ctx, 'render3d', { ...confirmed, model: 'missing' })).rejects.toThrow('presupuesto');
    expect(m.generate).not.toHaveBeenCalled();
  });
});
