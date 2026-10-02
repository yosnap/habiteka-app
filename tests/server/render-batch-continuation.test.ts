import { beforeEach, describe, expect, it, vi } from 'vitest';
import { twoRoomDocument } from '../fixtures/two-room-document';
import { defaultRenderDesignOptions } from '@/lib/editor-document/render-design-options';
const mocks = vi.hoisted(() => ({ rows: vi.fn(), revisions: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/server/db/prisma', () => ({ prisma: { deliverable: { findMany: mocks.rows } } }));
vi.mock('@/server/walkthrough/tour-images', () => ({ sameContentRevisions: mocks.revisions }));
import { assertRenderBatchCompatible, loadRenderBatchContinuation } from '@/server/agent/editor-v2/render-batch-continuation';

const ctx = { userId: 'user', organizationId: 'org', role: 'owner' as const }, scope = { projectId: 'project', zoneId: 'zone' };
const batchId = '7aaa64a7-3e2b-472c-802c-3889184d1105';
const options = { ...defaultRenderDesignOptions(), views: ['top', 'front', 'back', 'left', 'exterior'] as const };
const settings = () => ({ ...options, views: [...options.views] });
const row = (preset: string) => ({ payload: { type: 'render3d', generation: { provider: 'kie', documentRevision: 7,
  view: { preset, cutaway: false, ceilingView: 'solid' }, options: settings() } } });
beforeEach(() => { vi.resetAllMocks(); mocks.rows.mockResolvedValue([row('front'), row('back')]); mocks.revisions.mockResolvedValue([7]); });

describe('continuar una tanda de vistas guardadas', () => {
  it('recupera solo pendientes y vuelve a incluir una imagen descartada sin repetir las válidas', async () => {
    const left = row('left'); Object.assign(left.payload.generation, { review: { status: 'rejected', reason: 'Camas alteradas', reviewedAt: '2026-10-01' } });
    mocks.rows.mockResolvedValue([row('front'), row('back'), row('front'), left]);
    const result = await loadRenderBatchContinuation(ctx, scope, twoRoomDocument(), batchId);
    expect(result).toMatchObject({ batchId, completedViews: ['front', 'back'], options: { views: ['top', 'left', 'exterior'] } });
    expect(mocks.rows).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ projectId: 'project', zoneId: 'zone',
      project: { organizationId: 'org', deletedAt: null }, payload: { path: ['generation', 'batchId'], equals: batchId } }) }));
  });
  it('admite vistas pendientes distintas y bloquea mezclar luces o ámbitos antes de IA', async () => {
    await expect(assertRenderBatchCompatible(ctx, scope, twoRoomDocument(), batchId, { ...settings(), views: ['top', 'left', 'exterior'] })).resolves.toBeUndefined();
    await expect(assertRenderBatchCompatible(ctx, scope, twoRoomDocument(), batchId, { ...settings(), lighting: 'warm' })).rejects.toThrow('ajustes cambiaron');
    await expect(assertRenderBatchCompatible(ctx, scope, twoRoomDocument(), batchId, { ...settings(), designScope: 'house' })).rejects.toThrow('ajustes cambiaron');
  });
  it('rechaza una tanda ausente, de otra revisión o con ajustes mezclados', async () => {
    mocks.rows.mockResolvedValue([{ payload: null }]);
    await expect(loadRenderBatchContinuation(ctx, scope, twoRoomDocument(), batchId)).rejects.toThrow('ajustes necesarios');
    mocks.rows.mockResolvedValue([]);
    await expect(loadRenderBatchContinuation(ctx, scope, twoRoomDocument(), batchId)).rejects.toThrow('No se encontró');
    mocks.rows.mockResolvedValue([row('front')]); mocks.revisions.mockResolvedValue([]);
    await expect(loadRenderBatchContinuation(ctx, scope, twoRoomDocument(), batchId)).rejects.toThrow('diseño cambió');
    const back = row('back'); back.payload.generation.options.freedom = 'free';
    mocks.rows.mockResolvedValue([row('front'), back]); mocks.revisions.mockResolvedValue([7]);
    await expect(loadRenderBatchContinuation(ctx, scope, twoRoomDocument(), batchId)).rejects.toThrow('ajustes distintos');
  });
  it('una cámara que ocultó tabiques también vuelve a quedar pendiente', async () => {
    const back = row('back'); Object.assign(back.payload.generation.view, { cutaway: true, cutawayWallIds: ['w6'] });
    mocks.rows.mockResolvedValue([row('front'), back]);
    expect((await loadRenderBatchContinuation(ctx, scope, twoRoomDocument(), batchId)).options.views).toContain('back');
  });
});
