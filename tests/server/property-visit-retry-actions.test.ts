import { beforeEach, describe, expect, it, vi } from 'vitest';
import { visitFixture } from '../fixtures/property-visit-job';
const m = vi.hoisted(() => ({ read: vi.fn(), update: vi.fn() }));
vi.mock('@/server/auth/require-org-context', () => ({ requireOrgContext: async () => ({ userId: 'user', organizationId: 'org' }) }));
vi.mock('@/server/walkthrough/property-visit-repo', () => ({ readPropertyVisit: m.read, updatePropertyVisit: m.update }));
import { retryPropertyVisitItem } from '@/server/walkthrough/property-visit-retry-actions';
const scope = { projectId: 'project' };
beforeEach(() => vi.resetAllMocks());
describe('reintentos explícitos del paseo', () => {
  it('permite corregir imágenes ajenas al piloto pero protege sus extremos incluso tras preparar un reintento', async () => {
    const job = visitFixture();
    job.images.push({ ...structuredClone(job.images[0]!), id: 'image-3', state: 'review', sourceId: 'old-render' });
    job.segments[0]!.state = 'accepted';
    m.read.mockResolvedValue({ version: 4, job });
    await retryPropertyVisitItem(scope, 'visit', 'image', 'image-3');
    expect(m.update.mock.calls[0]![4].images[2]).toMatchObject({ state: 'pending', previousSourceIds: ['old-render'] });
    await expect(retryPropertyVisitItem(scope, 'visit', 'image', 'image-1')).rejects.toThrow('esta imagen');
    job.segments[0]!.state = 'pending'; job.segments[0]!.attempts = [{ state: 'rejected' }];
    await expect(retryPropertyVisitItem(scope, 'visit', 'image', 'image-1')).rejects.toThrow('esta imagen');
  });
  it('conserva el archivo rechazado y obliga a revisar la siguiente unión', async () => {
    const job = visitFixture(); Object.assign(job.segments[0]!, { state: 'rejected', taskId: 'task', assetKey: 'old.mp4' });
    Object.assign(job.segments[1]!, { state: 'accepted', reviewedBy: 'user', reviewedAt: 'now' });
    job.assetKey = 'complete.mp4'; job.finalReviewedAt = 'now'; m.read.mockResolvedValue({ version: 4, job });
    await retryPropertyVisitItem(scope, 'visit', 'segment', 'segment-1');
    const saved = m.update.mock.calls[0]![4];
    expect(saved.segments[0]).toMatchObject({ state: 'pending', attempts: [{ state: 'rejected', taskId: 'task', assetKey: 'old.mp4' }] });
    expect(saved.segments[0].taskId).toBeUndefined(); expect(saved.segments[1].state).toBe('review'); expect(saved.assetKey).toBeUndefined();
  });
  it.each(['unknown', 'submitting', 'generating'] as const)('nunca convierte un envío %s en otro cobro', async state => {
    const job = visitFixture(); job.segments[0]!.state = state; m.read.mockResolvedValue({ version: 4, job });
    await expect(retryPropertyVisitItem(scope, 'visit', 'segment', 'segment-1')).rejects.toThrow('inciertos');
    expect(m.update).not.toHaveBeenCalled();
  });
});
