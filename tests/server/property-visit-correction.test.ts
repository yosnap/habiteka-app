import { beforeEach, expect, it, vi } from 'vitest';
import { visitFixture } from '../fixtures/property-visit-job';
import type { OrgContext } from '@/server/auth/org-context';
const mocks = vi.hoisted(() => ({ find: vi.fn(), image: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/server/db/prisma', () => ({ prisma: { deliverable: { findFirst: mocks.find } } }));
vi.mock('@/server/agent/editor-v2/render-asset-reader', () => ({ readRenderReference: mocks.image }));
import { propertyVisitCorrection } from '@/server/walkthrough/property-visit-correction';
const ctx = { organizationId: 'org' } as OrgContext, scope = { projectId: 'project', zoneId: 'zone' };
function fixture() {
  const job = visitFixture(), image = { ...job.images[0]!, previousSourceIds: ['previous'] };
  const generation = { documentRevision: job.approvedRevision,
    review: { status: 'rejected', reason: 'No inventar una salida al jardín' },
    propertyVisit: { id: 'visit', imageId: image.id, openDoors: job.openDoors, anchorIds: job.anchorIds } };
  mocks.find.mockResolvedValue({ payload: { type: 'render3d', camera: image.frame.camera, generation } });
  return { job, image, generation };
}
beforeEach(() => { vi.resetAllMocks(); mocks.image.mockResolvedValue({ base64: 'draft', mimeType: 'image/png' }); });
it('reutiliza solo el borrador rechazado del mismo ámbito y cámara como corrección, no aceptación', async () => {
  const f = fixture(), result = await propertyVisitCorrection(ctx, scope, 'visit', f.job, f.image);
  expect(result).toMatchObject({ sourceId: 'previous', instruction: expect.stringContaining('BORRADOR RECHAZADO') });
  expect(result!.instruction).toContain('No inventar una salida al jardín');
  expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
    projectId: 'project', zoneId: 'zone', deletedAt: null, project: { organizationId: 'org' },
  }) }));
});
it('no lee imágenes ni referencias anteriores cuando es el primer intento', async () => {
  const f = fixture(); f.image.previousSourceIds = [];
  expect(await propertyVisitCorrection(ctx, scope, 'visit', f.job, f.image)).toBeNull();
  expect(mocks.find).not.toHaveBeenCalled(); expect(mocks.image).not.toHaveBeenCalled();
});
it('bloquea un borrador con otra revisión o cámara antes de consumir IA', async () => {
  const f = fixture(); f.generation.documentRevision++;
  await expect(propertyVisitCorrection(ctx, scope, 'visit', f.job, f.image)).rejects.toThrow('no corresponde');
  expect(mocks.image).not.toHaveBeenCalled();
});
it('no trata una imagen aceptada como borrador rechazado', async () => {
  const f = fixture(); Object.assign(f.generation, { acceptance: { userId: 'user', acceptedAt: 'now' } });
  expect(await propertyVisitCorrection(ctx, scope, 'visit', f.job, f.image)).toBeNull();
  expect(mocks.image).not.toHaveBeenCalled();
});
