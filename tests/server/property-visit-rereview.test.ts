import { beforeEach, describe, expect, it, vi } from 'vitest';
import { visitFixture } from '../fixtures/property-visit-job';
const m = vi.hoisted(() => ({ read: vi.fn(), find: vi.fn(), update: vi.fn(), audit: vi.fn(), vision: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/server/auth/require-org-context', () => ({ requireOrgContext: async () => ({ userId: 'user', organizationId: 'org' }) }));
vi.mock('@/server/walkthrough/property-visit-repo', () => ({ readPropertyVisit: m.read }));
vi.mock('@/server/db/prisma', () => ({ prisma: { deliverable: { findFirst: m.find },
  $transaction: (fn: (tx: unknown) => unknown) => fn({ deliverable: { updateMany: m.update } }) } }));
vi.mock('@/server/walkthrough/property-visit-sources', () => ({ propertyVisitSourceDocument: async () => ({}),
  propertyVisitAnchors: async () => [{ payload: {} }, { payload: {} }] }));
vi.mock('@/lib/editor-document/render-view-integrity', () => ({ assertRenderViewIntegrity: () => {} }));
vi.mock('@/lib/editor-document/property-visit-room-context', () => ({ propertyVisitRoomContext: () => ({ roomId: 'room' }) }));
vi.mock('@/server/agent/editor-v2/render-spatial-reference', () => ({ renderSpatialReference: async () => ({}) }));
vi.mock('@/server/agent/editor-v2/accepted-interior-prompt', () => ({ openingSightlineDepths: () => [] }));
vi.mock('@/server/agent/editor-v2/render-reference-frame', () => ({ fitRenderReferenceAspect: async (image: unknown) => ({ image }) }));
vi.mock('@/server/ai/image/input-sanitizer', () => ({ sanitizeImageBuffer: async () => ({}), sanitizeOwnRenderBuffer: async () => ({}) }));
vi.mock('@/server/agent/editor-v2/render-asset-reader', () => ({ readRenderBytes: async () => ({ raw: Buffer.from('image') }), readRenderReference: async () => ({}) }));
vi.mock('@/server/agent/editor-v2/selected-view-image-prompt', () => ({ projectVehicleCount: () => 0 }));
vi.mock('@/server/agent/editor-v2/review-render-fidelity', () => ({ reviewRenderFidelity: m.audit, unfinishedRenderReview: () => ({ review: { status: 'rejected' } }) }));
vi.mock('@/server/ai', () => ({ getChatVisionAdapter: m.vision }));
vi.mock('@/server/privacy/consent-service', () => ({ assertConsent: async () => {} }));
vi.mock('@/server/legal/tos-acceptance-service', () => ({ assertTosAccepted: async () => {} }));
import { rereviewPropertyVisitImage } from '@/server/walkthrough/property-visit-rereview-actions';
const scope = { projectId: 'project' };
function fixture() {
  const job = visitFixture(), image = job.images[0]!;
  image.sourceId = 'source'; image.state = 'review';
  const view = { preset: 'custom' as const, position: image.frame.camera.position, focus: image.frame.camera.focus,
    fov: 75, quaternion: [0, 0, 0, 1] as [number, number, number, number], aspect: 16 / 9, levelId: null,
    ceilingView: 'solid' as const, cutaway: false, allLevels: false, lighting: 'daylight' as const };
  const generation = { provider: 'kie', documentRevision: job.approvedRevision, view,
    review: { status: 'rejected', source: 'fidelity', reason: 'Oculto' },
    propertyVisit: { id: 'visit', imageId: image.id, openDoors: job.openDoors, anchorIds: job.anchorIds } };
  m.read.mockResolvedValue({ job, version: 3 });
  m.find.mockResolvedValue({ version: 2, payload: { type: 'render3d', generation } });
  return { job, generation, capture: { view: structuredClone(view), dataUrl: 'data:image/png;base64,YQ==' } };
}
beforeEach(() => { vi.resetAllMocks(); m.update.mockResolvedValue({ count: 1 }); m.audit.mockResolvedValue({ fidelity: { status: 'passed' } }); });
describe('revisión de un encuadre guardado sin regeneración', () => {
  it('conserva el informe previo y deja pendiente la aceptación después de pasar', async () => {
    const f = fixture();
    expect(await rereviewPropertyVisitImage(scope, 'visit', 'image-1', f.capture, true)).toMatchObject({ passed: true });
    const saved = m.update.mock.calls[1]![0].data.payload.generation;
    expect(saved.review).toBeUndefined(); expect(saved.acceptance).toBeUndefined();
    expect(saved.reviewHistory[0].review.reason).toBe('Oculto');
    expect(m.vision).toHaveBeenCalledWith(expect.objectContaining({ batchId: 'visit', refId: 'source' }), 'vision');
    expect(m.update.mock.calls[0]![0].where).toMatchObject({ id: 'visit', version: 3 });
  });
  it.each(['consent', 'camera', 'accepted', 'inspection', 'binding', 'video'] as const)('bloquea antes de gastar: %s', async kind => {
    const f = fixture();
    if (kind === 'camera') f.capture.view.position = [50, 1.6, 0];
    if (kind === 'accepted') Object.assign(f.generation, { acceptance: { userId: 'user' } });
    if (kind === 'inspection') f.generation.review.source = 'visual-inspection';
    if (kind === 'binding') f.generation.propertyVisit.id = 'other';
    if (kind === 'video') f.job.segments[0]!.state = 'generating';
    await expect(rereviewPropertyVisitImage(scope, 'visit', 'image-1', f.capture, kind !== 'consent')).rejects.toThrow();
    expect(m.vision).not.toHaveBeenCalled(); expect(m.update).not.toHaveBeenCalled();
  });
  it('no escribe sobre un paseo modificado durante el análisis', async () => {
    const f = fixture(); m.update.mockResolvedValueOnce({ count: 0 });
    await expect(rereviewPropertyVisitImage(scope, 'visit', 'image-1', f.capture, true)).rejects.toThrow('cambió');
    expect(m.update).toHaveBeenCalledTimes(1);
  });
  it('evita pagar dos revisiones simultáneas del mismo encuadre en el proceso', async () => {
    const f = fixture();
    let release!: (result: unknown) => void;
    let started!: () => void;
    const reached = new Promise<void>(resolve => { started = resolve; });
    m.audit.mockImplementationOnce(() => { started(); return new Promise(resolve => { release = resolve; }); });
    const first = rereviewPropertyVisitImage(scope, 'visit', 'image-1', f.capture, true);
    await reached;
    await expect(rereviewPropertyVisitImage(scope, 'visit', 'image-1', f.capture, true)).rejects.toThrow('en curso');
    release({ fidelity: { status: 'passed' } }); await first;
    expect(m.vision).toHaveBeenCalledTimes(1);
  });
});
