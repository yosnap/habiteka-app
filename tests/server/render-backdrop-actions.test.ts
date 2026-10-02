import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), load: vi.fn(), save: vi.fn(), list: vi.fn(), revalidate: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }));
vi.mock('@/server/auth/require-org-context', () => ({ requireOrgContext: mocks.auth }));
vi.mock('@/server/editor/document-repo', () => ({ withEditorDocuments: () => ({ load: mocks.load, save: mocks.save }) }));
vi.mock('@/server/db/scoped-repo', () => ({ withOrg: () => ({ deliverables: { list: mocks.list } }) }));
import { applyRenderBackdrop } from '@/server/editor/render-backdrop-actions';
const document = { ...emptyEditorDocument(), revision: 5 };
beforeEach(() => {
  vi.resetAllMocks(); mocks.auth.mockResolvedValue({ organizationId: 'org', userId: 'user' });
  mocks.load.mockResolvedValue({ authority: 'v2', writable: true, document });
  mocks.list.mockResolvedValue([{ id: 'render', type: 'RENDER_3D', zoneId: 'zone' }]);
  mocks.save.mockResolvedValue({ status: 'saved' });
});
describe('fondo de render en editor v2', () => {
  it('conserva el ámbito, usa revisión optimista y guarda el ID estable', async () => {
    expect(await applyRenderBackdrop({ projectId: 'project', zoneId: 'zone' }, 'render', 2)).toBe(true);
    expect(mocks.list).toHaveBeenCalledWith('project');
    expect(mocks.save).toHaveBeenCalledWith({ projectId: 'project', zoneId: 'zone' }, expect.objectContaining({
      expectedRevision: 5, document: expect.objectContaining({ renderBackdrop: expect.objectContaining({ deliverableId: 'render' }) }),
    }));
  });
  it('rechaza imágenes de otra zona y lecturas sin permiso antes de guardar', async () => {
    await expect(applyRenderBackdrop({ projectId: 'project' }, 'render', 1)).rejects.toThrow(/no pertenece/);
    expect(mocks.save).not.toHaveBeenCalled();
    mocks.load.mockRejectedValue(new Error('Fuera de ámbito')); mocks.list.mockClear();
    await expect(applyRenderBackdrop({ projectId: 'foreign' }, 'render', 1)).rejects.toThrow(/ámbito/);
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it('no pisa un conflicto ni modifica el plano de solo lectura', async () => {
    mocks.save.mockResolvedValue({ status: 'conflict' });
    await expect(applyRenderBackdrop({ projectId: 'project', zoneId: 'zone' }, 'render', 1)).rejects.toThrow(/cambió/);
    expect(mocks.revalidate).not.toHaveBeenCalled();
    mocks.load.mockResolvedValue({ authority: 'v2', writable: false, document }); mocks.save.mockClear();
    await expect(applyRenderBackdrop({ projectId: 'project', zoneId: 'zone' }, 'render', 1)).rejects.toThrow(/solo lectura/);
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
