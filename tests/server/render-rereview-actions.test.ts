/**
 * Volver a revisar una cenital descartada no genera otra imagen: compara la guardada con el plano de su revisión y
 * sustituye el informe. Solo se ofrece donde esa referencia se puede reconstruir y nunca acepta por el usuario.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { defaultRenderDesignOptions } from '@/lib/editor-document/render-design-options';
import { rereviewableRender } from '@/lib/editor-document/render-rereview';
import type { DeliverablePayload } from '@/lib/contracts/deliverable';

const mock = vi.hoisted(() => ({ auth: vi.fn(), project: vi.fn(), zones: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn(),
  consent: vi.fn(), tos: vi.fn(), load: vi.fn(), readRevision: vi.fn(), same: vi.fn(), bytes: vi.fn(), review: vi.fn(),
  lateral: vi.fn(), brief: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/server/auth/require-org-context', () => ({ requireOrgContext: mock.auth }));
vi.mock('@/server/db/scoped-repo', () => ({ withOrg: () => ({ projects: { findById: mock.project }, zones: { list: mock.zones } }) }));
vi.mock('@/server/db/prisma', () => ({ prisma: { deliverable: { findFirst: mock.findFirst, updateMany: mock.updateMany } } }));
vi.mock('@/server/privacy/consent-service', () => ({ assertConsent: mock.consent }));
vi.mock('@/server/legal/tos-acceptance-service', () => ({ assertTosAccepted: mock.tos }));
vi.mock('@/server/editor/document-repo', () => ({ withEditorDocuments: () => ({ load: mock.load, readRevision: mock.readRevision }) }));
vi.mock('@/server/walkthrough/tour-images', () => ({ sameVisualDesignContent: mock.same }));
vi.mock('@/server/ai', () => ({ getChatVisionAdapter: async () => ({ chat: vi.fn() }) }));
vi.mock('@/server/agent/editor-v2/render-asset-reader', () => ({ readRenderBytes: mock.bytes }));
vi.mock('@/server/agent/editor-v2/drone-references', () => ({ lateralDesignReference: mock.lateral }));
vi.mock('@/server/agent/editor-v2/section-furniture-brief', () => ({ sectionFurnitureBrief: mock.brief }));
vi.mock('@/server/agent/editor-v2/review-render-fidelity', async (actual) => ({
  ...(await actual<typeof import('@/server/agent/editor-v2/review-render-fidelity')>()), reviewRenderFidelity: mock.review }));
import { rereviewRenderDesign } from '@/app/(app)/projects/[id]/_actions/render-rereview-actions';

const house = () => addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 8000, y: 0 }, { x: 8000, y: 6000 }, { x: 0, y: 6000 }], true);
const top = { preset: 'top', position: [0, 20, 0], quaternion: [0, 0, 0, 1], focus: [0, 0, 0], fov: 45, aspect: 1,
  allLevels: false, cutaway: true, ceilingView: 'hidden', lighting: 'daylight' };
function discarded(generation: Record<string, unknown> = {}) {
  return { type: 'render3d', assetUrl: 'https://cdn/cenital.png', assetKey: 'renders/kie/cenital.png', generation: {
    provider: 'kie', model: 'gpt-image-2', promptVersion: 'habiteka-plan-simple-v6', documentRevision: 4, batchId: 'tanda',
    view: top, options: { ...defaultRenderDesignOptions(), views: ['top'] },
    fidelity: { status: 'rejected', version: 'spatial-fidelity-v6', checkedAt: '2026-10-06T22:06:28.000Z', roomChecks: [], openingChecks: [] },
    review: { status: 'rejected', reason: 'L1-O30: corredera con hojas incoherentes.', reviewedAt: '2026-10-06T22:06:28.000Z' }, ...generation } };
}
const passed = { status: 'passed', version: 'spatial-fidelity-v7', checkedAt: '2026-10-07T00:10:00.000Z', roomChecks: [], openingChecks: [] };

beforeEach(async () => {
  vi.clearAllMocks();
  mock.auth.mockResolvedValue({ organizationId: 'org', userId: 'user' });
  mock.project.mockResolvedValue({ id: 'project' });
  mock.zones.mockResolvedValue([]);
  mock.findFirst.mockResolvedValue({ payload: discarded(), version: 3 });
  mock.updateMany.mockResolvedValue({ count: 1 });
  mock.load.mockResolvedValue({ authority: 'v2', writable: true, document: house() });
  mock.readRevision.mockResolvedValue(house());
  mock.same.mockReturnValue(true);
  const png = await sharp({ create: { width: 320, height: 240, channels: 3, background: '#88aa66' } }).png().toBuffer();
  mock.bytes.mockResolvedValue({ raw: png, contentType: 'image/png' });
  mock.review.mockResolvedValue({ fidelity: passed });
  mock.lateral.mockResolvedValue({ identity: { base64: png.toString('base64'), mimeType: 'image/png' }, deliverableId: 'cenital-aceptada' });
  mock.brief.mockImplementation(async (_vision: unknown, _top: unknown, names: string[]) => ({ lines: names.map(name => `${name}: sin muebles`), pieces: names.map(() => []) }));
});

describe('volver a revisar una cenital descartada', () => {
  it('revisa la imagen guardada contra el plano de su revisión y la deja pendiente de aceptar', async () => {
    expect(await rereviewRenderDesign('project', null, 'cenital')).toMatchObject({ passed: true, reason: null, version: 4 });
    const args = mock.review.mock.calls[0]!;
    expect(args[3]).toMatchObject({ preset: 'top' });
    expect(args[11]).toMatchObject({ reference: 'plan' });
    const update = mock.updateMany.mock.calls[0]![0];
    expect(update.where).toMatchObject({ id: 'cenital', version: 3 });
    expect(update.data.version).toEqual({ increment: 1 });
    const generation = update.data.payload.generation;
    expect(generation.fidelity).toMatchObject({ status: 'passed', version: 'spatial-fidelity-v7' });
    expect(generation).not.toHaveProperty('review');
    expect(generation).not.toHaveProperty('acceptance');
    expect(update.data.payload.assetKey).toBe('renders/kie/cenital.png');
  });

  it('si vuelve a fallar conserva el descarte con el motivo nuevo', async () => {
    mock.review.mockResolvedValueOnce({ fidelity: { ...passed, status: 'rejected' },
      review: { status: 'rejected', reason: 'Hoja curva en L1-O4.', reviewedAt: '2026-10-07T00:10:00.000Z' } });
    expect(await rereviewRenderDesign('project', null, 'cenital')).toMatchObject({ passed: false, reason: 'Hoja curva en L1-O4.' });
    expect(mock.updateMany.mock.calls[0]![0].data.payload.generation.review.reason).toBe('Hoja curva en L1-O4.');
  });

  it('no gasta una revisión si el plano cambió o la imagen no admite esta revisión', async () => {
    mock.same.mockReturnValueOnce(false);
    expect(await rereviewRenderDesign('project', null, 'cenital')).toMatchObject({ actionError: expect.stringContaining('El plano cambió') });
    mock.findFirst.mockResolvedValueOnce({ payload: discarded({ view: { ...top, preset: 'isometric' } }), version: 3 });
    expect(await rereviewRenderDesign('project', null, 'cenital')).toMatchObject({ actionError: expect.stringContaining('laterales de toda la planta') });
    expect(mock.review).not.toHaveBeenCalled();
    expect(mock.updateMany).not.toHaveBeenCalled();
  });

  it('revisa una trasera contra su sección y la cenital aceptada que usó, sin generar otra imagen', async () => {
    // La trasera correcta se descartaba por un fallo de la revisión y no había forma de volver a revisarla.
    mock.findFirst.mockResolvedValueOnce({ payload: discarded({ view: { ...top, preset: 'back' }, promptVersion: 'habiteka-section-simple-v8',
      referenceDesignId: 'cenital-aceptada' }), version: 3 });
    expect(await rereviewRenderDesign('project', null, 'cenital')).toMatchObject({ passed: true, version: 4 });
    expect(mock.lateral.mock.calls[0]![5]).toBe('cenital-aceptada');
    const args = mock.review.mock.calls[0]!;
    expect(args[3]).toMatchObject({ preset: 'back' });
    expect(args[7]).toMatchObject({ lateral: true });
    expect(args[11]).toMatchObject({ reference: 'section', sectionRooms: expect.any(Array), sectionFurniture: [] });
    expect(mock.updateMany.mock.calls[0]![0].data.payload.generation.fidelity).toMatchObject({ status: 'passed' });
  });

  it('solo se ofrece en cenitales del plano descartadas por la revisión automática', () => {
    const payload = (generation: Record<string, unknown> = {}) => discarded(generation) as unknown as DeliverablePayload;
    expect(rereviewableRender(payload())).toBe(true);
    expect(rereviewableRender(payload({ review: undefined, fidelity: passed }))).toBe(false);
    expect(rereviewableRender(payload({ review: { status: 'rejected', reason: 'Inodoro duplicado', reviewedAt: 'x', source: 'visual-inspection' } }))).toBe(false);
    expect(rereviewableRender(payload({ promptVersion: 'habiteka-image-from-capture-v26' }))).toBe(false);
    // Frontal, trasera y laterales necesitan saber qué cenital aceptada usaron.
    const back = { view: { ...top, preset: 'back' }, promptVersion: 'habiteka-section-simple-v9' };
    expect(rereviewableRender(payload({ ...back, referenceDesignId: 'cenital-aceptada' }))).toBe(true);
    expect(rereviewableRender(payload(back))).toBe(false);
    expect(rereviewableRender(payload({ options: { ...defaultRenderDesignOptions(), placement: 'selected',
      regions: [{ id: 'z', name: 'Zona', polygon: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }] }] } }))).toBe(false);
  });
});
