import { beforeEach, describe, expect, it, vi } from 'vitest';
import { visitFixture } from '../fixtures/property-visit-job';
import { PROPERTY_VISIT_COMPACT_MODEL } from '@/lib/editor-document/property-visit-job';
const m = vi.hoisted(() => ({ auth: vi.fn(), read: vi.fn(), update: vi.fn(), sources: vi.fn(), key: vi.fn(), upload: vi.fn(), create: vi.fn(), status: vi.fn(), download: vi.fn(),
  reference: vi.fn(), put: vi.fn(), hold: vi.fn(), settle: vi.fn(), revert: vi.fn(), canUse: vi.fn(), premium: vi.fn(), cap: vi.fn(), spend: vi.fn(), outcome: vi.fn(), usage: vi.fn(), budget: vi.fn(), compact: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/server/auth/require-org-context', () => ({ requireOrgContext: m.auth }));
vi.mock('@/server/walkthrough/property-visit-repo', () => ({ readPropertyVisit: m.read, updatePropertyVisit: m.update }));
vi.mock('@/server/walkthrough/property-visit-sources', () => ({ propertyVisitAcceptedFrames: m.sources }));
vi.mock('@/server/walkthrough/property-visit-budget', () => ({ assertPropertyVisitBudget: m.budget }));
vi.mock('@/server/ai/provider-key-resolver', () => ({ resolveKieKey: m.key }));
vi.mock('@/server/ai/video/kie-video', async original => ({ ...await original<typeof import('@/server/ai/video/kie-video')>(),
  KieVideoProvider: class { uploadReference = m.upload; createTransition = m.create; createCompactTransition = m.compact; status = m.status; download = m.download; } }));
vi.mock('@/server/agent/editor-v2/render-asset-reader', () => ({ readRenderReference: m.reference }));
vi.mock('@/server/storage/s3-storage-adapter', () => ({ getStorageAdapter: () => ({ put: m.put }) }));
vi.mock('@/server/billing/credit-hold', () => ({ hold: m.hold, settle: m.settle, revert: m.revert }));
vi.mock('@/server/billing/gating', () => ({ canUse: m.canUse, isPremium: m.premium }));
vi.mock('@/server/billing/global-cap', () => ({ assertGlobalCap: m.cap }));
vi.mock('@/server/ai/guard/spend-guard', () => ({ assertCanSpend: m.spend, recordOutcome: m.outcome }));
vi.mock('@/server/db/prisma', () => ({ prisma: { usageEvent: { upsert: m.usage } } }));
import { startPropertyVisitSegment, checkPropertyVisitSegment, reviewPropertyVisitSegment } from '@/server/walkthrough/property-visit-video-actions';
import { KieSubmissionUnknownError } from '@/server/ai/video/kie-video';
const scope = { projectId: 'project', zoneId: null }, consent = { referencesToKie: true, maxUsd: .16 };
let stored: { version: number; job: ReturnType<typeof visitFixture> };
beforeEach(() => {
  vi.resetAllMocks(); stored = { version: 1, job: visitFixture() };
  m.auth.mockResolvedValue({ userId: 'user', organizationId: 'org' });
  m.read.mockImplementation(async () => structuredClone(stored));
  m.update.mockImplementation(async (_ctx, _scope, _id, version, job) => {
    if (version !== stored.version) throw new Error('Conflicto'); stored = { version: version + 1, job: structuredClone(job) }; return stored.version;
  });
  m.sources.mockResolvedValue([{ id: 'a', imageId: 'image-1', version: 2, payload: {} }, { id: 'b', imageId: 'image-2', version: 3, payload: {} }]);
  m.canUse.mockResolvedValue({ allowed: true }); m.upload.mockResolvedValueOnce('https://example.com/a.png').mockResolvedValue('https://example.com/b.png');
  m.create.mockResolvedValue('task'); m.status.mockResolvedValue({ state: 'pending' });
});
describe('tramos enlazados del paseo', () => {
  it('envía solo el tramo elegido y valida sus extremos sin exigir las imágenes pendientes', async () => {
    stored.job.images.push({ ...structuredClone(stored.job.images[0]!), id: 'image-pending' });
    await startPropertyVisitSegment(scope, 'visit', 'segment-1', { ...consent, onlyThisSegment: true });
    expect(m.sources).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'visit', expect.anything(), ['image-1', 'image-2']);
    expect(m.create).toHaveBeenCalledTimes(1);
    expect(stored.job.segments[1]!.state).toBe('pending');
    expect(stored.job.images[2]!.state).toBe('pending');
    m.status.mockResolvedValue({ state: 'success', resultUrl: 'https://example.com/video.mp4' });
    await checkPropertyVisitSegment(scope, 'visit', 'segment-1');
    await reviewPropertyVisitSegment(scope, 'visit', 'segment-1', true);
    expect(m.sources).toHaveBeenLastCalledWith(expect.anything(), expect.anything(), 'visit', expect.anything(), ['image-1', 'image-2']);
  });
  it('cobra Hailuo según el modelo guardado y no usa H3 como alternativa', async () => {
    stored.job.videoModel = PROPERTY_VISIT_COMPACT_MODEL;
    stored.job.segments.forEach(segment => { segment.seconds = 6; }); stored.job.durationMs = 12000;
    m.compact.mockResolvedValue('compact-task');
    await startPropertyVisitSegment(scope, 'visit', 'segment-1', consent);
    expect(m.sources).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'visit', expect.anything(), undefined);
    expect(m.compact).toHaveBeenCalledWith(expect.any(String), 6, 'https://example.com/a.png', 'https://example.com/b.png');
    expect(m.create).not.toHaveBeenCalled();
    expect(m.usage).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ cost: .15 }) }));
  });
  it('bloquea el presupuesto completo antes de reservar saldo o enviar referencias', async () => {
    m.budget.mockRejectedValueOnce(new Error('Supera el máximo de 2 € por vídeo completo'));
    await expect(startPropertyVisitSegment(scope, 'visit', 'segment-1', consent)).rejects.toThrow('2 €');
    expect(m.hold).not.toHaveBeenCalled(); expect(m.upload).not.toHaveBeenCalled(); expect(m.create).not.toHaveBeenCalled();
  });
  it('bloquea consentimiento insuficiente y referencias sin aceptación antes del gasto', async () => {
    await expect(startPropertyVisitSegment(scope, 'visit', 'segment-1', { ...consent, maxUsd: 0 })).rejects.toThrow('Confirma');
    m.sources.mockRejectedValueOnce(new Error('Falta aceptar una imagen'));
    await expect(startPropertyVisitSegment(scope, 'visit', 'segment-1', consent)).rejects.toThrow('aceptar');
    expect(m.hold).not.toHaveBeenCalled(); expect(m.create).not.toHaveBeenCalled();
  });
  it('guarda el identificador y las versiones antes de liquidar; nunca reenvía el mismo tramo', async () => {
    await startPropertyVisitSegment(scope, 'visit', 'segment-1', consent);
    expect(stored.job.segments[0]).toMatchObject({ state: 'generating', taskId: 'task', sourceVersions: [{ id: 'a', version: 2 }, { id: 'b', version: 3 }] });
    expect(m.create).toHaveBeenCalledWith(expect.any(String), 4, '768P', 'https://example.com/a.png', 'https://example.com/b.png');
    await expect(startPropertyVisitSegment(scope, 'visit', 'segment-1', consent)).rejects.toThrow('ya se envió');
    await checkPropertyVisitSegment(scope, 'visit', 'segment-1'); expect(m.create).toHaveBeenCalledTimes(1);
  });
  it('una respuesta incierta conserva el intento y bloquea otro envío', async () => {
    m.create.mockRejectedValueOnce(new KieSubmissionUnknownError('Respuesta incierta'));
    await expect(startPropertyVisitSegment(scope, 'visit', 'segment-1', consent)).rejects.toThrow('incierta');
    expect(stored.job.segments[0]!.state).toBe('unknown'); expect(m.revert).not.toHaveBeenCalled();
    await expect(startPropertyVisitSegment(scope, 'visit', 'segment-2', consent)).rejects.toThrow('en curso');
    expect(m.create).toHaveBeenCalledTimes(1);
  });
  it('descarga un resultado sin aceptarlo; rechaza revisión si sus referencias cambiaron', async () => {
    await startPropertyVisitSegment(scope, 'visit', 'segment-1', consent);
    m.status.mockResolvedValue({ state: 'success', resultUrl: 'https://example.com/video.mp4' });
    await checkPropertyVisitSegment(scope, 'visit', 'segment-1'); expect(stored.job.segments[0]!.state).toBe('review');
    m.sources.mockResolvedValueOnce([{ id: 'a', version: 99 }, { id: 'b', version: 3 }]);
    await expect(reviewPropertyVisitSegment(scope, 'visit', 'segment-1', true)).rejects.toThrow('cambiaron');
    await reviewPropertyVisitSegment(scope, 'visit', 'segment-1', true);
    expect(stored.job.segments[0]).toMatchObject({ state: 'accepted', reviewedBy: 'user' });
    expect(m.create).toHaveBeenCalledTimes(1);
  });
});
