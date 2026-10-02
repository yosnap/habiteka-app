import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import type { OrgContext } from '@/server/auth/org-context';
const mocks = vi.hoisted(() => ({ approval: vi.fn(), load: vi.fn(), revision: vi.fn(), rows: vi.fn(), url: vi.fn() }));
vi.mock('@/server/editor/document-repo', () => ({ withEditorDocuments: () => ({ readApproval: mocks.approval, load: mocks.load, readRevision: mocks.revision }) }));
vi.mock('@/server/db/prisma', () => ({ prisma: { deliverable: { findMany: mocks.rows } } }));
vi.mock('@/server/storage/render-urls', () => ({ resolveRenderUrl: mocks.url }));
import { validatedImageTourSources } from '@/server/walkthrough/image-tour-sources';
const ctx = { organizationId: 'org', userId: 'user' } as OrgContext;
const scope = { projectId: 'project', zoneId: null };
const row = (id: string, revision = 2, lighting = 'daylight') => ({ id, createdAt: new Date(), payload: {
  generation: { documentRevision: revision, view: { preset: 'front', lighting }, options: { freedom: 'strict' } },
} });
beforeEach(() => {
  vi.resetAllMocks();
  const document = { ...emptyEditorDocument(), revision: 2 };
  mocks.approval.mockResolvedValue({ id: 'approval', revision: 2, document });
  mocks.load.mockResolvedValue({ authority: 'v2', document });
  mocks.rows.mockResolvedValue([row('a')]); mocks.url.mockResolvedValue('https://storage.example/a.png');
});
describe('fuentes del vídeo vinculadas al diseño', () => {
  it('acepta una selección parcial coherente y limita la consulta a organización, proyecto y zona', async () => {
    await expect(validatedImageTourSources(ctx, scope, 'approval', ['a'])).resolves.toMatchObject({ revision: 2 });
    expect(mocks.rows).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      projectId: 'project', project: { organizationId: 'org' }, zoneId: null, deletedAt: null, type: 'RENDER_3D',
    }) }));
  });
  it('rechaza un borrador con nuevo tejado antes de leer archivos o firmar una subida', async () => {
    mocks.load.mockResolvedValue({ authority: 'v2', document: { ...emptyEditorDocument(), exteriorRoof: { kind: 'gable' } } });
    await expect(validatedImageTourSources(ctx, scope, 'approval', ['a'])).rejects.toThrow(/diseño ha cambiado/);
    expect(mocks.rows).not.toHaveBeenCalled(); expect(mocks.url).not.toHaveBeenCalled();
  });
  it('rechaza renders de una casa anterior aunque pertenezcan al mismo proyecto', async () => {
    mocks.rows.mockResolvedValue([row('a', 1)]);
    mocks.revision.mockResolvedValue({ ...emptyEditorDocument(), labels: [{ id: 'label', x: 0, y: 0, text: 'Casa anterior' }] });
    await expect(validatedImageTourSources(ctx, scope, 'approval', ['a'])).rejects.toThrow(/no corresponden al diseño aprobado/);
  });
  it('rechaza luces mezcladas y archivos ausentes', async () => {
    mocks.rows.mockResolvedValue([row('a'), row('b', 2, 'warm')]);
    await expect(validatedImageTourSources(ctx, scope, 'approval', ['a', 'b'])).rejects.toThrow(/luces mezcladas/);
    mocks.rows.mockResolvedValue([row('a')]); mocks.url.mockResolvedValue(null);
    await expect(validatedImageTourSources(ctx, scope, 'approval', ['a'])).rejects.toThrow(/archivo disponible/);
  });
  it('rechaza IDs repetidos o ajenos al ámbito', async () => {
    await expect(validatedImageTourSources(ctx, scope, 'approval', ['a', 'a'])).rejects.toThrow(/distintas/);
    expect(mocks.approval).not.toHaveBeenCalled();
    mocks.rows.mockResolvedValue([]);
    await expect(validatedImageTourSources(ctx, scope, 'approval', ['a'])).rejects.toThrow(/ámbito/);
  });
});
