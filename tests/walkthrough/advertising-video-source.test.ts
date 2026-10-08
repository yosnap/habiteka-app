import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import type { OrgContext } from '@/server/auth/org-context';
const mocks = vi.hoisted(() => ({ approval: vi.fn(), load: vi.fn(), row: vi.fn(), url: vi.fn(), designs: vi.fn(), montage: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/server/editor/document-repo', () => ({ withEditorDocuments: () => ({ readApproval: mocks.approval, load: mocks.load }) }));
vi.mock('@/server/db/prisma', () => ({ prisma: { deliverable: { findFirst: mocks.row } } }));
vi.mock('@/server/storage/render-urls', () => ({ resolveRenderUrl: mocks.url }));
vi.mock('@/server/walkthrough/design-video-sources', () => ({ designVideoSources: mocks.designs }));
vi.mock('@/server/walkthrough/image-tour-sources', () => ({ validatedImageTourSources: mocks.montage }));
import { advertisingVideoSource } from '@/server/walkthrough/advertising-video-source';
const ctx = { organizationId: 'org', userId: 'user' } as OrgContext, scope = { projectId: 'project', zoneId: 'zone' };
const payload = () => ({ assetKey: 'videos/org/project/source.mp4', approvalId: 'approval', approvedFingerprint: 'fingerprint', durationMs: 8000,
  mode: 'construction-ai', status: 'accepted', sourceIds: ['design'] });
beforeEach(() => {
  vi.resetAllMocks();
  const document = emptyEditorDocument();
  mocks.approval.mockResolvedValue({ id: 'approval', revision: 2, fingerprint: 'fingerprint', document });
  mocks.load.mockResolvedValue({ authority: 'v2', document });
  mocks.row.mockResolvedValue({ payload: payload() }); mocks.url.mockResolvedValue('https://storage.example/source.mp4');
});
describe('procedencia del clip publicitario', () => {
  it.each(['construction', 'walkthrough', 'showcase', 'promotion', undefined])('no admite el original nativo %s', async mode => {
    mocks.row.mockResolvedValue({ payload: { ...payload(), mode } });
    await expect(advertisingVideoSource(ctx, scope, 'approval', 'clip')).rejects.toThrow(/plano 3D/);
    expect(mocks.url).not.toHaveBeenCalled();
  });
  it('revalida la aceptación de fuentes H3 antes de servir el vídeo', async () => {
    mocks.designs.mockRejectedValue(new Error('Aceptación retirada'));
    await expect(advertisingVideoSource(ctx, scope, 'approval', 'clip')).rejects.toThrow('Aceptación retirada');
    expect(mocks.designs).toHaveBeenCalledWith(ctx, scope, 'approval', ['design']);
    expect(mocks.url).not.toHaveBeenCalled();
  });
  it('revalida fuentes del montaje antes de publicidad', async () => {
    mocks.row.mockResolvedValue({ payload: { ...payload(), mode: 'images', sourceDeliverableIds: ['image'] } });
    await advertisingVideoSource(ctx, scope, 'approval', 'clip');
    expect(mocks.montage).toHaveBeenCalledWith(ctx, scope, 'approval', ['image']);
  });
  it('acepta H3 revisado y restringe la lectura al usuario, proyecto y zona', async () => {
    await expect(advertisingVideoSource(ctx, scope, 'approval', 'clip')).resolves.toMatchObject({ durationMs: 8000 });
    expect(mocks.approval).toHaveBeenCalledWith(scope, 'approval');
    expect(mocks.row).toHaveBeenCalledWith({ where: { id: 'clip', projectId: 'project', zoneId: 'zone', type: 'VIDEO', deletedAt: null,
      project: { organizationId: 'org', deletedAt: null } } });
  });
  it.each(['review', 'rejected', 'running'])('bloquea H3 %s antes de descargarlo', async status => {
    mocks.row.mockResolvedValue({ payload: { ...payload(), status } });
    await expect(advertisingVideoSource(ctx, scope, 'approval', 'clip')).rejects.toThrow(/acepta la fidelidad/);
    expect(mocks.url).not.toHaveBeenCalled();
  });
  it.each(['review', 'rejected', 'generating'])('bloquea primera persona H3 %s antes de publicidad', async status => {
    mocks.row.mockResolvedValue({ payload: { ...payload(), mode: 'walkthrough-ai', status } });
    await expect(advertisingVideoSource(ctx, scope, 'approval', 'clip')).rejects.toThrow(/acepta la fidelidad/);
    expect(mocks.url).not.toHaveBeenCalled();
  });
  it.each([{ approvalId: 'other' }, { approvedFingerprint: 'other' }, { assetKey: undefined }])('bloquea un original incompatible %j', async override => {
    mocks.row.mockResolvedValue({ payload: { ...payload(), ...override } });
    await expect(advertisingVideoSource(ctx, scope, 'approval', 'clip')).rejects.toThrow(/no pertenece/);
    expect(mocks.url).not.toHaveBeenCalled();
  });
  it('bloquea cambios en el diseño antes de leer el archivo', async () => {
    mocks.load.mockResolvedValue({ authority: 'v2', document: { ...emptyEditorDocument(), labels: [{ id: 'new', x: 0, y: 0, text: 'Cambio' }] } });
    await expect(advertisingVideoSource(ctx, scope, 'approval', 'clip')).rejects.toThrow(/diseño ha cambiado/);
    expect(mocks.row).not.toHaveBeenCalled();
  });
  it('rechaza anuncios derivados y originales que superan el límite', async () => {
    mocks.row.mockResolvedValue({ payload: { ...payload(), mode: 'advertising' } });
    await expect(advertisingVideoSource(ctx, scope, 'approval', 'clip')).rejects.toThrow(/original/);
    mocks.row.mockResolvedValue({ payload: { ...payload(), durationMs: 110001 } });
    await expect(advertisingVideoSource(ctx, scope, 'approval', 'clip')).rejects.toThrow(/110/);
  });
});
