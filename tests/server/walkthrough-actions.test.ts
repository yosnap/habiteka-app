import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), presign: vi.fn(), inspect: vi.fn(), transaction: vi.fn() }));
vi.mock('@/server/auth/require-org-context', () => ({ requireOrgContext: mocks.auth }));
vi.mock('@/server/storage/s3-storage-adapter', () => ({ getStorageAdapter: () => ({ getPresignedUploadUrl: mocks.presign, inspect: mocks.inspect }) }));
vi.mock('@/server/db/prisma', () => ({ prisma: { $transaction: mocks.transaction } }));
import { prepareWalkthroughUpload, finishWalkthroughUpload } from '@/server/walkthrough/actions';
beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue({ organizationId: 'org', userId: 'user' }); });
describe('retirada de exportaciones del plano guía', () => {
  it.each(['walkthrough', 'construction', 'showcase', 'promotion'] as const)('no emite ticket ni toca storage para %s', async mode => {
    await expect(prepareWalkthroughUpload({ projectId: 'project' }, 'approval', 'route', 64, mode)).rejects.toThrow('diseños IA aceptados');
    expect(mocks.presign).not.toHaveBeenCalled(); expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it('no publica tickets nativos anteriores ni modifica entregables', async () => {
    await expect(finishWalkthroughUpload('previous-native-ticket')).rejects.toThrow('diseños IA aceptados');
    expect(mocks.inspect).not.toHaveBeenCalled(); expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it('exige sesión también para clientes antiguos', async () => {
    mocks.auth.mockRejectedValue(new Error('Sin sesión'));
    await expect(prepareWalkthroughUpload({ projectId: 'project' }, 'approval', 'route', 64)).rejects.toThrow('Sin sesión');
    await expect(finishWalkthroughUpload('ticket')).rejects.toThrow('Sin sesión');
  });
});
