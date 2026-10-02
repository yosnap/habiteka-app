import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ rows: vi.fn(), revisions: vi.fn(), read: vi.fn(), sanitize: vi.fn(), stored: vi.fn() }));
vi.mock('@/server/storage/s3-storage-adapter', () => ({ getStorageAdapter: () => ({ get: mocks.stored }) }));
vi.mock('@/server/db/prisma', () => ({ prisma: { deliverable: { findMany: mocks.rows } } }));
vi.mock('@/server/walkthrough/tour-images', () => ({ sameContentRevisions: mocks.revisions }));
vi.mock('@/server/agent/editor-v2/render-asset-reader', () => ({ readRenderReference: mocks.read }));
vi.mock('@/server/ai/image/input-sanitizer', () => ({ sanitizeImageBuffer: mocks.sanitize }));
import { droneReferences } from '@/server/agent/editor-v2/drone-references';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { defaultRenderDesignOptions } from '@/lib/editor-document/render-design-options';
import type { OrgContext } from '@/server/auth/org-context';
import type { RenderView } from '@/lib/editor-document/render-view';

const ctx = { organizationId: 'org' } as OrgContext;
const scope = { projectId: 'p', zoneId: null };
const view = { preset: 'drone', levelId: null } as RenderView;
const options = defaultRenderDesignOptions();
const image = { base64: 'aGVsbG8=', mimeType: 'image/png' };
const ortho = 'data:image/png;base64,aGVsbG8=';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rows.mockResolvedValue([{ id: 'anchor', payload: { assetKey: 'own.png', generation: {
    documentRevision: 144, view: { lighting: 'daylight' }, options: { freedom: 'strict', placement: 'all' } } } }]);
  mocks.revisions.mockResolvedValue([144]); mocks.read.mockResolvedValue(image); mocks.sanitize.mockResolvedValue(image);
});
describe('referencias obligatorias del dron', () => {
  it('no utiliza como ancla una imagen descartada en la revisión posterior', async () => {
    mocks.rows.mockResolvedValue([{ id: 'anchor', payload: { assetKey: 'own.png', generation: {
      documentRevision: 144, review: { status: 'rejected', reason: 'Cocina alterada', reviewedAt: '2026-10-01T21:00:00Z' },
      view: { lighting: 'daylight' }, options: { freedom: 'strict', placement: 'all' } } } }]);
    await expect(droneReferences(ctx, scope, emptyEditorDocument(), view, options, ortho)).rejects.toThrow('auditada');
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it('exige una cenital compatible para fijar la identidad del exterior terminado', async () => {
    const exterior = { ...view, preset: 'exterior' as const };
    expect(await droneReferences(ctx, scope, emptyEditorDocument(), exterior, options, ortho)).toMatchObject({ deliverableId: 'anchor' });
    expect(mocks.rows.mock.calls[0]![0].where.OR).toEqual([{ payload: { path: ['generation', 'view', 'preset'], equals: 'top' } }]);
    mocks.revisions.mockResolvedValue([]);
    await expect(droneReferences(ctx, scope, emptyEditorDocument(), exterior, options, ortho)).rejects.toThrow('Falta una cenital');
  });
  it('usa la copia confirmada del proyecto sin permitir sustituirla por otra ortofoto', async () => {
    const document = { ...emptyEditorDocument(), geographicSite: {
      source: 'IGN-PNOA' as const, latitude: 40.7, longitude: -3.5, groundWidthM: 180,
      assetKey: 'geographic-sites/org/p/00000000-0000-4000-8000-000000000000.jpg', capturedAt: '2026-09-30T10:00:00.000Z',
      anchor: { x: .5, y: .5 }, planOriginMm: { x: 0, y: 0 }, rotationDeg: 0,
      intervention: [{ x: .2, y: .2 }, { x: .8, y: .2 }, { x: .8, y: .8 }],
      scenario: 'reconstruction' as const, lighting: 'daylight' as const, confirmed: true,
    } };
    mocks.stored.mockResolvedValue(Buffer.from('stored'));
    await droneReferences(ctx, scope, document, view, options, ortho);
    expect(mocks.stored).toHaveBeenCalledWith(document.geographicSite.assetKey);
    expect(mocks.sanitize).toHaveBeenCalledWith(Buffer.from('stored'));
    document.geographicSite.assetKey = document.geographicSite.assetKey.replace('/org/', '/foreign/');
    mocks.stored.mockClear();
    await expect(droneReferences(ctx, scope, document, view, options)).rejects.toThrow(/pertenece/);
    expect(mocks.stored).not.toHaveBeenCalled();
  });
  it('no genera una vista lejana sin ortofoto o sin una referencia del mismo diseño', async () => {
    await expect(droneReferences(ctx, scope, emptyEditorDocument(), view, options)).rejects.toThrow('ortofoto');
    expect(mocks.rows).not.toHaveBeenCalled();
    mocks.revisions.mockResolvedValue([]);
    await expect(droneReferences(ctx, scope, emptyEditorDocument(), view, options, ortho)).rejects.toThrow('Falta una isométrica');
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it('lee solo una referencia compatible del proyecto y organización', async () => {
    expect(await droneReferences(ctx, scope, emptyEditorDocument(), view, options, ortho))
      .toMatchObject({ identity: image, environment: image, deliverableId: 'anchor' });
    expect(mocks.rows.mock.calls[0]![0].where).toMatchObject({ projectId: 'p', zoneId: null,
      project: { organizationId: 'org' }, deletedAt: null });
  });
  it('conserva el fondo neutro en Solo la casa y exige una referencia del mismo ámbito', async () => {
    const row = { id: 'house', payload: { generation: { documentRevision: 144,
      view: { lighting: 'daylight' }, options: { freedom: 'strict', designScope: 'house' } } } };
    mocks.rows.mockResolvedValue([row]);
    const result = await droneReferences(ctx, scope, emptyEditorDocument(), view, { ...options, designScope: 'house' });
    expect(result?.environment).toBeUndefined();
    expect(result?.deliverableId).toBe('house');
  });
  it('ignora ortofotos para otras vistas', async () => {
    expect(await droneReferences(ctx, scope, emptyEditorDocument(), { ...view, preset: 'top' }, options)).toBeNull();
    expect(mocks.rows).not.toHaveBeenCalled();
  });
  it('requiere cenital para isométrica y no mezcla permiso de rediseño', async () => {
    await droneReferences(ctx, scope, emptyEditorDocument(), { ...view, preset: 'isometric' }, options, ortho);
    expect(mocks.rows.mock.calls[0]![0].where.OR).toEqual([{ payload: { path: ['generation', 'view', 'preset'], equals: 'top' } }]);
    await expect(droneReferences(ctx, scope, emptyEditorDocument(), view, { ...options, redesignFixed: true }, ortho))
      .rejects.toThrow('permiso de rediseño');
  });
  it('no usa una referencia de todas las plantas para una sola planta', async () => {
    await expect(droneReferences(ctx, scope, emptyEditorDocument(), { ...view, allLevels: true }, options, ortho))
      .rejects.toThrow('Falta una isométrica');
  });
});
