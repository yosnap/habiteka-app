/**
 * Cerrar el tejado gasta una generación y una revisión: se valida todo antes de pagar y el resultado es una imagen nueva
 * de la misma tanda, con la cubierta visible, revisada y sin heredar la aceptación de la base.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { PerspectiveCamera } from 'three';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { setExteriorRoof } from '@/lib/editor-document/exterior-roof';
import { defaultRenderDesignOptions } from '@/lib/editor-document/render-design-options';

const mock = vi.hoisted(() => ({ auth: vi.fn(), project: vi.fn(), zones: vi.fn(), findFirst: vi.fn(), consent: vi.fn(), tos: vi.fn(),
  load: vi.fn(), readRevision: vi.fn(), same: vi.fn(), generate: vi.fn(), chat: vi.fn(), persist: vi.fn(), read: vi.fn(), bytes: vi.fn(), put: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/server/auth/require-org-context', () => ({ requireOrgContext: mock.auth }));
vi.mock('@/server/db/scoped-repo', () => ({ withOrg: () => ({ projects: { findById: mock.project }, zones: { list: mock.zones } }) }));
vi.mock('@/server/db/prisma', () => ({ prisma: { deliverable: { findFirst: mock.findFirst } } }));
vi.mock('@/server/privacy/consent-service', () => ({ assertConsent: mock.consent }));
vi.mock('@/server/legal/tos-acceptance-service', () => ({ assertTosAccepted: mock.tos }));
vi.mock('@/server/editor/document-repo', () => ({ withEditorDocuments: () => ({ load: mock.load, readRevision: mock.readRevision }) }));
vi.mock('@/server/walkthrough/tour-images', () => ({ sameVisualDesignContent: mock.same }));
vi.mock('@/server/ai', () => ({ getImageAdapterForAction: () => ({ generate: mock.generate }), getChatVisionAdapter: () => ({ chat: mock.chat }) }));
vi.mock('@/server/storage/s3-storage-adapter', () => ({ getStorageAdapter: () => ({ put: mock.put, getPresignedDownloadUrl: async (key: string) => `https://minio/${key}` }) }));
vi.mock('@/server/agent/persistence/deliverable-repo', () => ({ persistDeliverables: mock.persist }));
vi.mock('@/server/agent/legal/seal', () => ({ DELIVERABLE_LEGAL_SEAL: 'sello' }));
vi.mock('@/server/agent/editor-v2/render-asset-reader', () => ({ readRenderReference: mock.read, readRenderBytes: mock.bytes }));
import { closeRoofFromModel } from '@/app/(app)/projects/[id]/_actions/roof-closure-actions';

const house = () => setExteriorRoof(addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 10000, y: 0 }, { x: 10000, y: 8000 }, { x: 0, y: 8000 }], true), { kind: 'hip', pitchDeg: 20 });
function view() {
  const camera = new PerspectiveCamera(40, 16 / 9);
  camera.position.set(19, 15, 17); camera.lookAt(5, 1.5, 4); camera.updateMatrixWorld();
  return { preset: 'isometric', position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), focus: [5, 1.5, 4],
    fov: 40, aspect: 16 / 9, allLevels: false, cutaway: false, ceilingView: 'hidden', lighting: 'daylight' };
}
const accepted = { acceptedAt: '2026-10-06T10:00:00.000Z', userId: 'user' };
function baseRow(generation: Record<string, unknown> = {}) {
  return { payload: { type: 'render3d', assetUrl: 'https://cdn/base.png', assetKey: 'renders/base.png', generation: {
    provider: 'kie', model: 'gpt-image-2', promptVersion: 'habiteka-section-simple-v7', documentRevision: 4, batchId: 'tanda',
    view: view(), options: { ...defaultRenderDesignOptions(), views: ['isometric'] }, acceptance: accepted,
    fidelity: { status: 'passed', version: 'v5', checkedAt: '2026-10-06T09:00:00.000Z', roomChecks: [], openingChecks: [] }, ...generation } } };
}

beforeEach(async () => {
  vi.clearAllMocks();
  mock.auth.mockResolvedValue({ organizationId: 'org', userId: 'user' });
  mock.project.mockResolvedValue({ id: 'project' });
  mock.zones.mockResolvedValue([{ id: 'zona' }]);
  mock.findFirst.mockImplementation(async ({ where }: { where: { id?: string } }) => where.id ? baseRow() : null);
  mock.load.mockResolvedValue({ authority: 'v2', writable: true, document: house() });
  mock.readRevision.mockResolvedValue(house());
  mock.same.mockReturnValue(true);
  const png = await sharp({ create: { width: 320, height: 180, channels: 3, background: '#88aa66' } }).png().toBuffer();
  mock.read.mockResolvedValue({ base64: png.toString('base64'), mimeType: 'image/png' });
  mock.bytes.mockResolvedValue({ raw: png, contentType: 'image/png' });
  mock.generate.mockResolvedValue({ assetUrl: 'https://cdn/tejado.png', assetKey: 'renders/kie/tejado.png',
    generation: { provider: 'kie', model: 'gpt-image-2', fallbackIndex: 0 } });
  const pass = { status: 'pass', observation: 'Coincide con la maqueta.' };
  mock.chat.mockResolvedValue({ structured: { roof: pass, framing: pass, identity: pass, photorealistic: pass }, execution: { provider: 'openrouter', model: 'visión' } });
});

describe('cerrar el tejado desde el modelo', () => {
  it('crea una imagen nueva de la misma tanda con la cubierta visible y sin la aceptación de la base', async () => {
    const result = await closeRoofFromModel('project', null, 'base');
    expect(result).toMatchObject({ assetUrl: 'https://cdn/tejado.png' });
    const request = mock.generate.mock.calls[0]![0];
    // Imagen aceptada primero y maqueta del modelo después; la proporción es la de la imagen aceptada.
    expect(request.referenceImages).toHaveLength(2);
    expect(request.aspectRatio).toBe('16:9');
    expect(request.prompt).toContain('cuatro aguas');
    expect(mock.chat.mock.calls[0]![0].messages[0].content.filter((part: { type: string }) => part.type === 'image_url')).toHaveLength(3);
    const saved = mock.persist.mock.calls[0]![1][0];
    const generation = saved.payload.generation;
    expect(generation.view).toMatchObject({ preset: 'isometric', ceilingView: 'solid', cutaway: false });
    expect(generation.batchId).toBe('tanda');
    expect(generation.roofClosure.baseDeliverableId).toBe('base');
    expect(generation.acceptance).toBeUndefined();
    expect(generation.fidelity).toMatchObject({ status: 'passed', version: 'habiteka-roof-closure-v2' });
    expect(generation.review).toBeUndefined();
    // Misma condición que usa el vídeo de construcción para «Fachadas y tejado».
    expect(generation.view.ceilingView === 'solid' && generation.view.cutaway !== true).toBe(true);
  });

  it('guarda descartada la imagen con tejado si la revisión falla o no responde', async () => {
    const pass = { status: 'pass', observation: 'Bien.' };
    mock.chat.mockResolvedValueOnce({ structured: { roof: { status: 'fail', observation: 'Falta la chimenea.' }, framing: pass, identity: pass, photorealistic: pass } });
    await closeRoofFromModel('project', null, 'base');
    expect(mock.persist.mock.calls[0]![1][0].payload.generation.review.reason).toContain('Falta la chimenea.');
    const { aiError } = await import('@/server/ai/errors');
    mock.chat.mockRejectedValueOnce(aiError('timeout', 'El modelo no respondió'));
    await closeRoofFromModel('project', null, 'base');
    expect(mock.persist.mock.calls[1]![1][0].payload.generation.review.reason).toContain('no se completó');
  });

  it('no gasta si la imagen no está aceptada', async () => {
    mock.findFirst.mockImplementation(async ({ where }: { where: { id?: string } }) => where.id ? baseRow({ acceptance: undefined }) : null);
    expect(await closeRoofFromModel('project', null, 'base')).toMatchObject({ actionError: expect.stringContaining('Acepta primero') });
    expect(mock.generate).not.toHaveBeenCalled();
  });

  it('rechaza proyectos o zonas de otra organización antes de leer la imagen', async () => {
    mock.project.mockResolvedValue(null);
    expect(await closeRoofFromModel('ajeno', null, 'base')).toMatchObject({ actionError: expect.stringContaining('Proyecto no encontrado') });
    mock.project.mockResolvedValue({ id: 'project' });
    expect(await closeRoofFromModel('project', 'otra-zona', 'base')).toMatchObject({ actionError: expect.stringContaining('Zona no encontrada') });
    expect(mock.findFirst).not.toHaveBeenCalled();
    expect(mock.generate).not.toHaveBeenCalled();
  });

  it('no gasta si el plano cambió o si la vista ya tiene su imagen con tejado', async () => {
    mock.same.mockReturnValue(false);
    expect(await closeRoofFromModel('project', null, 'base')).toMatchObject({ actionError: expect.stringContaining('El plano cambió') });
    mock.same.mockReturnValue(true);
    mock.findFirst.mockImplementation(async ({ where }: { where: { id?: string } }) => where.id ? baseRow() : { id: 'ya-cerrada' });
    expect(await closeRoofFromModel('project', null, 'base')).toMatchObject({ actionError: expect.stringContaining('ya tiene su imagen con tejado') });
    expect(mock.generate).not.toHaveBeenCalled();
  });

  it('solo cierra isométricas o drones de toda la planta', async () => {
    mock.findFirst.mockImplementation(async ({ where }: { where: { id?: string } }) => where.id ? baseRow({ view: { ...view(), preset: 'top' } }) : null);
    expect(await closeRoofFromModel('project', null, 'base')).toMatchObject({ actionError: expect.stringContaining('isométrica o un dron') });
    expect(mock.generate).not.toHaveBeenCalled();
  });
});
