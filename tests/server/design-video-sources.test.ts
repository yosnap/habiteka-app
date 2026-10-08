import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultRenderDesignOptions } from '@/lib/editor-document/render-design-options';
import { twoRoomDocument } from '../fixtures/two-room-document';
import { roomInteriorCameras } from '@/lib/editor-document/room-interior-cameras';
const mocks = vi.hoisted(() => ({ list: vi.fn(), approval: vi.fn(), latest: vi.fn(), load: vi.fn(), revisions: vi.fn(), tour: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/server/db/prisma', () => ({ prisma: { deliverable: { findMany: mocks.list } } }));
vi.mock('@/server/editor/document-repo', () => ({ withEditorDocuments: () => ({ readApproval: mocks.approval, latestApproval: mocks.latest, load: mocks.load }) }));
vi.mock('@/server/storage/render-urls', () => ({ resolveRenderUrl: async () => 'https://storage.example/design.png' }));
vi.mock('@/server/walkthrough/tour-images', () => ({ sameContentRevisions: mocks.revisions, tourImagesFromRows: mocks.tour, tourDocumentReader: () => {}, sameVisualDesignContent: () => true }));
import { designVideoSources } from '@/server/walkthrough/design-video-sources';
const scope = { projectId: 'project', zoneId: 'zone' }, ctx = { organizationId: 'org', userId: 'user', role: 'owner' as const };
const row = (id = 'design', provider = 'kie') => ({ id, createdAt: new Date(), payload: { type: 'render3d', assetKey: 'renders/design.png',
  generation: { provider, acceptance: { userId: 'user', acceptedAt: '2026-10-02T16:00:00Z' }, documentRevision: 7, batchId: 'batch', view: { preset: 'top', ceilingView: 'hidden' },
    options: { ...defaultRenderDesignOptions(), placement: 'selected', regions: ['Patio', 'Baño exterior', 'Rampa', 'Escalera'].map((name, i) => ({ id: String(i), name,
      polygon: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }] })) } } } });
beforeEach(() => {
  vi.resetAllMocks(); mocks.approval.mockResolvedValue({ id: 'approval', revision: 7, document: twoRoomDocument() }); mocks.latest.mockResolvedValue({ id: 'approval', revision: 7, document: twoRoomDocument() });
  mocks.load.mockResolvedValue({ authority: 'v2', document: {} }); mocks.revisions.mockResolvedValue([7]); mocks.tour.mockResolvedValue([]); mocks.list.mockResolvedValue([row()]);
});
describe('referencias del diseño para vídeo', () => {
  it('bloquea diseños no aceptados aunque hayan pasado la generación y conserva su aviso en la lista', async () => {
    const pending = row(); delete (pending.payload.generation as { acceptance?: unknown }).acceptance;
    mocks.list.mockResolvedValue([pending]);
    expect((await designVideoSources(ctx, scope)).references[0]?.issue).toContain('acepta su diseño');
    await expect(designVideoSources(ctx, scope, 'approval', ['design'])).rejects.toThrow('acepta su diseño');
    expect(mocks.tour).not.toHaveBeenCalled();
  });
  it('un interior conserva su cámara y su propia luz aunque la aprobación del plano tenga otra', async () => {
    const document = twoRoomDocument(), camera = roomInteriorCameras(document)[0]!.camera;
    const interior = row();
    Object.assign(interior.payload.generation.view, { preset: 'custom', position: camera.position, focus: camera.focus, levelId: camera.levelId,
      quaternion: [0, 0, 0, 1], fov: camera.fovDeg, aspect: 16 / 9, allLevels: false, cutaway: false, ceilingView: 'solid', lighting: 'daylight' });
    mocks.latest.mockResolvedValue({ id: 'approval', revision: 7, lightingPreset: 'warm', document });
    mocks.list.mockResolvedValue([interior]);
    const reference = (await designVideoSources(ctx, scope)).references[0]!;
    expect(reference.interiorRoomId).toBeTruthy();
    expect(reference.visitIssue).toBeUndefined();
    expect(reference.lighting).toBe('daylight');
    Object.assign(interior.payload.generation.view, { lighting: 'warm' });
    expect((await designVideoSources(ctx, scope)).references[0]?.visitIssue).toBeUndefined();
  });
  it('primera persona verifica la aprobación de origen sin exigir que el borrador siga igual', async () => {
    mocks.load.mockResolvedValue({ authority: 'legacy' });
    await expect(designVideoSources(ctx, scope, 'approval', ['design'])).rejects.toThrow('ha cambiado');
    mocks.load.mockClear();
    const result = await designVideoSources(ctx, scope, 'approval', ['design'], 'walkthrough-ai');
    expect(result.approved?.revision).toBe(7);
    expect(mocks.load).not.toHaveBeenCalled();
    expect(mocks.revisions).toHaveBeenCalled();
    mocks.revisions.mockResolvedValue([]);
    await expect(designVideoSources(ctx, scope, 'approval', ['design'], 'walkthrough-ai')).rejects.toThrow('otra revisión');
  });
  it('impide usar una imagen descartada posteriormente aunque su cámara conserve los tabiques', async () => {
    const bad = row();
    Object.assign(bad.payload.generation, { review: { status: 'rejected', reason: 'Camas convertidas en butacas', reviewedAt: '2026-10-01T21:00:00Z' } });
    mocks.list.mockResolvedValue([bad]);
    expect((await designVideoSources(ctx, scope)).references[0]?.issue).toBe('Camas convertidas en butacas');
    await expect(designVideoSources(ctx, scope, 'approval', ['design'])).rejects.toThrow('Camas convertidas en butacas');
    expect(mocks.tour).not.toHaveBeenCalled();
  });
  it('mantiene visible una foto con tabiques ocultos pero impide seleccionarla para preparar o enviar', async () => {
    const bad = row(); Object.assign(bad.payload.generation.view, { preset: 'back', cutaway: true, cutawayWallIds: ['w6'] });
    mocks.list.mockResolvedValue([bad]);
    expect((await designVideoSources(ctx, scope)).references[0]?.issue).toContain('tabiques interiores');
    await expect(designVideoSources(ctx, scope, 'approval', ['design'])).rejects.toThrow('tabiques interiores');
    expect(mocks.tour).not.toHaveBeenCalled();
  });
  it('lee las selecciones congeladas del render, incluye exteriores y limita por organización/proyecto/zona', async () => {
    const result = await designVideoSources(ctx, scope, 'approval', ['design']);
    expect(result.references[0]).toMatchObject({ zones: ['Patio', 'Baño exterior', 'Rampa', 'Escalera'], batchId: 'batch', revision: 7 });
    expect(mocks.list).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ projectId: 'project', zoneId: 'zone',
      project: { organizationId: 'org', deletedAt: null }, id: { in: ['design'] } }) }));
  });
  it('no sustituye diseños ausentes por renders nativos ni por imágenes de otra revisión', async () => {
    mocks.list.mockResolvedValue([row('design', 'native')]);
    await expect(designVideoSources(ctx, scope, 'approval', ['design'])).rejects.toThrow('otra revisión');
    mocks.list.mockResolvedValue([row()]); mocks.revisions.mockResolvedValue([8]);
    await expect(designVideoSources(ctx, scope, 'approval', ['design'])).rejects.toThrow('otra revisión');
  });
  it('rechaza una imagen ajena o con ámbito antiguo sin inventar su selección', async () => {
    mocks.list.mockResolvedValue([]);
    await expect(designVideoSources(ctx, scope, 'approval', ['foreign'])).rejects.toThrow('otra revisión');
    const invalid = row(); invalid.payload.generation.options.regions = [];
    mocks.list.mockResolvedValue([invalid]);
    await expect(designVideoSources(ctx, scope, 'approval', ['design'])).rejects.toThrow('ámbito');
  });
});
