import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ rows: vi.fn(), scope: vi.fn(), stored: vi.fn(), revisions: vi.fn(), url: vi.fn() }));
vi.mock('@/server/auth/require-org-context', () => ({ requireOrgContext: async () => ({ organizationId: 'org' }) }));
vi.mock('@/server/db/prisma', () => ({ prisma: { $transaction: async (fn: (tx: unknown) => unknown) => fn({}), deliverable: { findMany: mocks.rows } } }));
vi.mock('@/server/editor/authority', () => ({ assertEditorScope: mocks.scope }));
vi.mock('@/server/editor/document-repo', () => ({ withEditorDocuments: () => ({ readRevision: mocks.stored }) }));
vi.mock('@/server/walkthrough/tour-images', async importOriginal => ({ ...await importOriginal<object>(), sameContentRevisions: mocks.revisions }));
vi.mock('@/server/storage/render-urls', () => ({ resolveRenderUrl: mocks.url }));
import { listRenderReferences } from '@/server/agent/editor-v2/render-reference-actions';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { defaultRenderDesignOptions } from '@/lib/editor-document/render-design-options';
import { optionsFromReference, referenceSettingIssues, requiredReferencePreset } from '@/lib/editor-document/render-reference-compatibility';
import type { RenderView } from '@/lib/editor-document/render-view';

const document = { ...emptyEditorDocument(), revision: 4 }, options = defaultRenderDesignOptions();
const view: RenderView = { preset: 'front', position: [0, 2, 4], quaternion: [0, 0, 0, 1], fov: 50, aspect: 1.5, allLevels: false, cutaway: true };
const row = (id: string) => ({ id, version: 2, createdAt: new Date('2026-10-05T12:00:00Z'), payload: { assetKey: `${id}.png`, generation: {
  provider: 'kie', documentRevision: 4, view: { preset: 'top', lighting: 'daylight' }, options: { freedom: 'strict', placement: 'all' } } } });
beforeEach(() => {
  vi.clearAllMocks(); mocks.scope.mockResolvedValue({ projectId: 'p', zoneId: 'z' }); mocks.rows.mockResolvedValue([row('pending')]);
  mocks.stored.mockResolvedValue(document); mocks.revisions.mockResolvedValue([4]); mocks.url.mockResolvedValue('https://own.test/image.png');
});
describe('biblioteca de referencias del diseño', () => {
  it('consulta solo proyecto, zona, organización y vista fuente y conserva la aceptación pendiente', async () => {
    const result = await listRenderReferences({ projectId: 'p', zoneId: 'z' }, document, view, options);
    expect(mocks.rows.mock.calls[0]![0].where).toMatchObject({ projectId: 'p', zoneId: 'z', deletedAt: null,
      project: { organizationId: 'org', deletedAt: null }, payload: { path: ['generation', 'view', 'preset'], equals: 'top' } });
    expect(result.items[0]).toMatchObject({ item: { id: 'pending', version: 2, payload: { assetUrl: 'https://own.test/image.png' } }, issues: [] });
    expect(result.items[0]!.item.payload.generation?.acceptance).toBeUndefined();
    mocks.scope.mockRejectedValue(new Error('Proyecto o zona no encontrado')); mocks.rows.mockClear();
    await expect(listRenderReferences({ projectId: 'foreign' }, document, view, options)).rejects.toThrow('no encontrado');
    expect(mocks.rows).not.toHaveBeenCalled();
  });
  it('explica cambios en borrador, luz y permiso y permite paginar', async () => {
    mocks.rows.mockResolvedValue(Array.from({ length: 41 }, (_, i) => row(`image-${i}`)));
    const draft = { ...document, furniture: [{ id: 'new', kind: 'silla', x: 100, y: 200, widthMm: 500, depthMm: 500, rotation: 0, dimensionalOrigin: 'physical' as const }] };
    const result = await listRenderReferences({ projectId: 'p', zoneId: 'z' }, draft, view, { ...options, lighting: 'warm', redesignFixed: true });
    expect(result.items).toHaveLength(40); expect(result.nextCursor).toBe('image-39');
    expect(result.items[0]!.issues.join(' ')).toMatch(/luz.*rediseño.*plano actual/);
    await listRenderReferences({ projectId: 'p', zoneId: 'z' }, document, view, options, result.nextCursor!);
    expect(mocks.rows.mock.calls[1]![0]).toMatchObject({ cursor: { id: 'image-39' }, skip: 1 });
  });
  it('el dron necesita isométrica y los interiores también necesitan la cenital aceptada', () => {
    expect(requiredReferencePreset({ ...view, preset: 'drone' }, options)).toBe('isometric');
    expect(requiredReferencePreset({ ...view, preset: 'exterior' }, options)).toBe('top');
    expect(requiredReferencePreset(view, { ...options, designScope: 'interior', interiorRoomIds: ['room'] })).toBe('top');
  });
  it('recupera los ajustes compatibles del diseño sin sustituir las cámaras solicitadas', () => {
    const current = { ...options, views: ['front', 'drone'] as const };
    const result = optionsFromReference({ view: { lighting: 'afternoon' }, options: { freedom: 'controlled', redesignFixed: true, placement: 'all' } }, { ...current, views: [...current.views] });
    expect(result).toMatchObject({ lighting: 'afternoon', freedom: 'controlled', redesignFixed: true, views: ['front', 'drone'] });
    expect(optionsFromReference({ view: { lighting: 'unknown' }, options: { freedom: 'strict' } }, options)).toBeNull();
  });
  it('los interiores toman mobiliario de la cenital aceptada con su propia luz', () => {
    const interior = { ...options, designScope: 'interior' as const, interiorRoomIds: ['room'], lighting: 'warm' as const, freedom: 'strict' as const };
    const generation = row('top').payload.generation;
    expect(referenceSettingIssues(generation, view, interior)).toEqual([]);
    expect(referenceSettingIssues(generation, view, { ...interior, interiorRoomIds: [] })).toContain('La luz es diferente.');
    expect(optionsFromReference(generation, interior)).toMatchObject({ lighting: 'warm', freedom: 'strict' });
  });
});
