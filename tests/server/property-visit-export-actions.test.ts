import { beforeEach, describe, expect, it, vi } from 'vitest';
import { visitFixture } from '../fixtures/property-visit-job';
const m = vi.hoisted(() => ({ read: vi.fn(), update: vi.fn(), sources: vi.fn(), inspect: vi.fn(), promote: vi.fn(), upload: vi.fn() }));
vi.mock('@/server/auth/require-org-context', () => ({ requireOrgContext: async () => ({ userId: 'user', organizationId: 'org' }) }));
vi.mock('@/server/walkthrough/property-visit-repo', () => ({ readPropertyVisit: m.read, updatePropertyVisit: m.update }));
vi.mock('@/server/walkthrough/property-visit-sources', () => ({ propertyVisitAcceptedFrames: m.sources }));
vi.mock('@/server/storage/s3-storage-adapter', () => ({ getStorageAdapter: () => ({ inspect: m.inspect, promote: m.promote,
  getPresignedUploadUrl: m.upload, getPresignedDownloadUrl: async (key: string) => key }) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
import { preparePropertyVisitUpload, finishPropertyVisitUpload, propertyVisitExportSources, propertyVisitExportClip, reviewPropertyVisitFinal } from '@/server/walkthrough/property-visit-export-actions';
const scope = { projectId: 'project', zoneId: null };
let job: ReturnType<typeof visitFixture>;
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv('BETTER_AUTH_SECRET', 'test-only-property-visit-secret'); job = visitFixture();
  job.segments.forEach(segment => Object.assign(segment, { state: 'accepted', assetKey: `${segment.id}.mp4`, reviewedBy: 'user', sourceVersions: [{ id: 'source', version: 2 }] }));
  m.read.mockImplementation(async () => ({ version: 4, job })); m.sources.mockResolvedValue([{ id: 'source', version: 2 }]);
  m.inspect.mockResolvedValue({ bytes: 1000, contentType: 'video/mp4', header: Buffer.from('0000ftypisom') });
});
describe('exportación del paseo revisado', () => {
  it('exporta tramos en orden y acepta el final solo tras revisión expresa', async () => {
    expect(await propertyVisitExportSources(scope, 'visit')).toEqual({ version: 4, clips: [{ seconds: 4, url: '' }, { seconds: 4, url: '' }] });
    expect(await propertyVisitExportClip(scope, 'visit', 1, 4)).toBe('segment-2.mp4');
    const { ticket } = await preparePropertyVisitUpload(scope, 'visit', 1000, 8000, 4);
    await finishPropertyVisitUpload(ticket);
    const saved = m.update.mock.calls[0]![4]; expect(saved.assetKey).toContain('complete-4.mp4'); expect(saved.finalReviewedAt).toBeUndefined();
    job = saved; await expect(reviewPropertyVisitFinal(scope, 'visit', false)).rejects.toThrow('Reproduce');
    await reviewPropertyVisitFinal(scope, 'visit', true);
    expect(m.update.mock.calls[1]![4].finalReviewedBy).toBe('user');
  });
  it('bloquea un tramo pendiente o una referencia modificada aunque haya vídeo', async () => {
    job.segments[0]!.state = 'review';
    await expect(preparePropertyVisitUpload(scope, 'visit', 1000, 8000, 4)).rejects.toThrow('Revisa todos');
    job.segments[0]!.state = 'accepted'; m.sources.mockResolvedValue([{ id: 'source', version: 3 }]);
    await expect(preparePropertyVisitUpload(scope, 'visit', 1000, 8000, 4)).rejects.toThrow('cambió');
    expect(m.upload).not.toHaveBeenCalled();
  });
  it('rechaza duración parcial, exceso de tamaño, modificación concurrente y un archivo falso', async () => {
    await expect(preparePropertyVisitUpload(scope, 'visit', 1000, 4000, 4)).rejects.toThrow('duración');
    await expect(preparePropertyVisitUpload(scope, 'visit', 1024 ** 3 + 1, 8000, 4)).rejects.toThrow('1 GB');
    await expect(propertyVisitExportClip(scope, 'visit', 0, 3)).rejects.toThrow('cambió');
    await expect(preparePropertyVisitUpload(scope, 'visit', 1000, 8000, 3)).rejects.toThrow('cambió');
    const { ticket } = await preparePropertyVisitUpload(scope, 'visit', 1000, 8000, 4);
    m.read.mockResolvedValueOnce({ version: 5, job }); await expect(finishPropertyVisitUpload(ticket)).rejects.toThrow('cambió');
    m.inspect.mockResolvedValueOnce({ bytes: 1000, contentType: 'video/mp4', header: Buffer.from('not-a-video') });
    await expect(finishPropertyVisitUpload(ticket)).rejects.toThrow('MP4 esperado'); expect(m.promote).not.toHaveBeenCalled();
  });
  it('recupera un MP4 ya promovido si falló la persistencia posterior', async () => {
    const { ticket } = await preparePropertyVisitUpload(scope, 'visit', 1000, 8000, 4);
    m.inspect.mockRejectedValueOnce(new Error('Temporal ya eliminado'));
    await finishPropertyVisitUpload(ticket);
    expect(m.promote).not.toHaveBeenCalled(); expect(m.update).toHaveBeenCalledOnce();
  });
});
