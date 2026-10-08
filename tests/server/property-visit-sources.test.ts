import { beforeEach, describe, expect, it, vi } from 'vitest';
import { visitFixture } from '../fixtures/property-visit-job';
import { twoRoomDocument } from '../fixtures/two-room-document';
const m = vi.hoisted(() => ({ list: vi.fn(), approval: vi.fn(), anchors: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/server/db/prisma', () => ({ prisma: { deliverable: { findMany: m.list } } }));
vi.mock('@/server/editor/document-repo', () => ({ withEditorDocuments: () => ({ readApproval: m.approval }) }));
vi.mock('@/server/walkthrough/design-video-sources', () => ({ designVideoSources: m.anchors }));
import { propertyVisitAcceptedFrames } from '@/server/walkthrough/property-visit-sources';
const ctx = { userId: 'user', organizationId: 'org', role: 'owner' as const }, scope = { projectId: 'project', zoneId: 'zone' };
function fixture() {
  const job = visitFixture();
  const rows = job.images.map(image => {
    image.sourceId = image.id;
    return { id: image.id, version: 1, payload: { type: 'render3d', assetKey: 'renders/image.png', generation: {
      provider: 'kie', documentRevision: job.approvedRevision, acceptance: { userId: 'user', acceptedAt: new Date().toISOString() },
      propertyVisit: { id: 'visit', imageId: image.id, anchorIds: job.anchorIds, openDoors: job.openDoors },
      view: { preset: 'custom', position: image.frame.camera.position, focus: image.frame.camera.focus,
        fov: image.frame.camera.fovDeg, quaternion: [0, 0, 0, 1], aspect: 16 / 9, levelId: null,
        ceilingView: 'solid', cutaway: false, allLevels: false, lighting: 'daylight' } } } };
  });
  return { job, rows };
}
beforeEach(() => {
  vi.resetAllMocks(); m.approval.mockResolvedValue({ fingerprint: 'a'.repeat(64), document: twoRoomDocument() });
  m.anchors.mockResolvedValue({ references: ['top', 'roof'].map(id => ({ id, lighting: 'daylight' })), rows: [{ id: 'top' }, { id: 'roof' }] });
});
describe('referencias exactas y aceptadas del paseo', () => {
  it('permite los dos extremos del piloto mientras conserva el bloqueo de la exportación completa', async () => {
    const { job, rows } = fixture();
    job.images.push({ ...structuredClone(job.images[0]!), id: 'image-pending', sourceId: undefined });
    m.list.mockResolvedValue(rows);
    expect(await propertyVisitAcceptedFrames(ctx, scope, 'visit', job, ['image-1', 'image-2'])).toHaveLength(2);
    await expect(propertyVisitAcceptedFrames(ctx, scope, 'visit', job)).rejects.toThrow('Falta generar');
    delete (rows[1]!.payload.generation as { acceptance?: unknown }).acceptance;
    await expect(propertyVisitAcceptedFrames(ctx, scope, 'visit', job, ['image-1', 'image-2'])).rejects.toThrow();
  });
  it.each([{ ids: [] }, { ids: ['unknown'] }])('rechaza una selección vacía o ajena al paseo: $ids', async ({ ids }) => {
    await expect(propertyVisitAcceptedFrames(ctx, scope, 'visit', fixture().job, ids)).rejects.toThrow('no pertenecen');
    expect(m.list).not.toHaveBeenCalled();
  });
  it('resuelve cada encuadre dentro de organización, proyecto y zona', async () => {
    const { job, rows } = fixture(); m.list.mockResolvedValue(rows);
    expect(await propertyVisitAcceptedFrames(ctx, scope, 'visit', job)).toHaveLength(2);
    expect(m.list).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ projectId: 'project', zoneId: 'zone',
      project: { organizationId: 'org', deletedAt: null } }) }));
  });
  it.each(['acceptance', 'native', 'camera', 'revision', 'binding', 'ceiling', 'doors', 'lighting', 'aspect'] as const)('bloquea una referencia alterada: %s', async field => {
    const { job, rows } = fixture(), generation = rows[0]!.payload.generation;
    if (field === 'acceptance') delete (generation as { acceptance?: unknown }).acceptance;
    if (field === 'camera') generation.view.position = [100, 1.6, 0];
    if (field === 'revision') generation.documentRevision++;
    if (field === 'binding') generation.propertyVisit.id = 'other-visit';
    if (field === 'ceiling') generation.view.ceilingView = 'hidden';
    if (field === 'doors') generation.propertyVisit.openDoors = false;
    if (field === 'lighting') generation.view.lighting = 'warm';
    if (field === 'aspect') generation.view.aspect = 4;
    if (field === 'native') generation.provider = 'native';
    m.list.mockResolvedValue(rows);
    await expect(propertyVisitAcceptedFrames(ctx, scope, 'visit', job)).rejects.toThrow();
  });
  it('no sustituye una imagen ausente ni un diseño base que ha perdido aceptación', async () => {
    const { job } = fixture(); m.list.mockResolvedValue([]);
    await expect(propertyVisitAcceptedFrames(ctx, scope, 'visit', job)).rejects.toThrow('Falta generar');
    m.anchors.mockResolvedValue({ references: [], rows: [] });
    await expect(propertyVisitAcceptedFrames(ctx, scope, 'visit', job)).rejects.toThrow('referencia');
  });
});
