import { beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
const fixture = vi.hoisted(() => ({ inpaint: vi.fn(), record: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/server/ai/model-routing', () => ({ resolveRoutes: async () => [
  { provider: 'kie', model: 'primary', baseURL: null, fallbacks: [] },
  { provider: 'kie', model: 'backup', baseURL: null, fallbacks: [] },
] }));
vi.mock('@/server/ai/provider-key-resolver', () => ({ resolveProviderKey: async () => 'test', resolveKieKey: async () => 'test' }));
vi.mock('@/server/ai/image/providers/kie-image', () => ({ KieImageProvider: class { inpaint = fixture.inpaint; } }));
vi.mock('@/server/storage/s3-storage-adapter', () => ({ getStorageAdapter: () => { throw new Error('Sin storage en la prueba'); } }));
vi.mock('@/server/analytics/ai-cost-recorder', () => ({ recordAiAttempt: fixture.record, aiErrorCode: () => 'test' }));
vi.mock('@/server/ai/guard/spend-guard', () => ({ assertCanSpend: vi.fn(), recordOutcome: vi.fn() }));
vi.mock('@/server/privacy/jurisdiction-allowlist', () => ({ enforceModelJurisdiction: vi.fn() }));
import { getImageAdapterForAction } from '@/server/ai';

beforeEach(() => vi.clearAllMocks());
const pixels = async (width: number, height: number, background: string) => sharp({ create: { width, height, channels: 4, background } }).png().toBuffer();
const request = async () => ({ baseImage: { base64: (await pixels(20, 10, '#123456')).toString('base64'), mimeType: 'image/png' },
  zone: { id: 'detail', bbox: { x: .2, y: .2, width: .2, height: .2 } }, prompt: 'Corrige el detalle' });
const response = async (width: number, height: number) => ({ assetUrl: `data:image/png;base64,${(await pixels(width, height, '#ffffff')).toString('base64')}`,
  cost: { unit: 'image', amountUsd: .15 } });

describe('protección conectada al adaptador real de inpaint', () => {
  it('la factory entrega máscara al proveedor y devuelve el resultado protegido con su modelo efectivo', async () => {
    fixture.inpaint.mockResolvedValue(await response(20, 10));
    const image = await getImageAdapterForAction({ organizationId: 'test', projectId: 'project' }, 'inpaint');
    const result = await image.inpaint(await request());
    expect(result.regionEdit?.protectedPixels).toBe(192);
    expect(result.generation).toEqual({ provider: 'kie', model: 'primary', fallbackIndex: 0 });
    expect(fixture.inpaint).toHaveBeenCalledWith(expect.objectContaining({ editMask: expect.objectContaining({ mimeType: 'image/png' }) }));
    expect(fixture.record).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'project', action: 'inpaint', operation: 'inpaint', status: 'success' }));
  });
  it('un rechazo de composición no activa el proveedor de respaldo ni otra generación', async () => {
    fixture.inpaint.mockResolvedValue(await response(10, 10));
    const image = await getImageAdapterForAction({ organizationId: 'test' }, 'inpaint');
    await expect(image.inpaint(await request())).rejects.toThrow('proporción');
    expect(fixture.inpaint).toHaveBeenCalledTimes(1);
    expect(fixture.record).toHaveBeenCalledTimes(1);
  });
});
