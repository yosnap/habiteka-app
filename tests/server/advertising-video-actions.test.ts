import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readUploadTicket, signUploadTicket } from '@/server/walkthrough/upload-ticket';
import { callAction } from '@/lib/action-result';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), source: vi.fn(), scope: vi.fn(), inspect: vi.fn(), promote: vi.fn(), presign: vi.fn(),
  existing: vi.fn(), find: vi.fn(), create: vi.fn(), usage: vi.fn(), transaction: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/server/auth/require-org-context', () => ({ requireOrgContext: mocks.auth }));
vi.mock('@/server/walkthrough/advertising-video-source', () => ({ advertisingVideoSource: mocks.source }));
vi.mock('@/server/editor/authority', () => ({ assertEditorScope: mocks.scope }));
vi.mock('@/server/storage/s3-storage-adapter', () => ({ getStorageAdapter: () => ({ inspect: mocks.inspect, promote: mocks.promote, getPresignedUploadUrl: mocks.presign }) }));
vi.mock('@/server/db/prisma', () => ({ prisma: { deliverable: { findFirst: mocks.existing }, $transaction: mocks.transaction } }));
import { prepareAdvertisingUpload, finishAdvertisingUpload } from '@/server/walkthrough/advertising-video-actions';
const scope = { projectId: 'project', zoneId: 'zone' }, options = { format: 'vertical', dimensionMode: 'animated' } as const;
const info = { bytes: 64, contentType: 'video/mp4', header: Buffer.from('0000ftyp00000000000000000000000000') };
const source = () => ({ approved: { id: 'approval', revision: 2, fingerprint: 'a'.repeat(64) }, durationMs: 8000,
  measurements: { widthM: 4, depthM: 5, heightM: 2.7 } });
const prepare = () => callAction(prepareAdvertisingUpload(scope, 'approval', 'clip', 64, options));
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv('BETTER_AUTH_SECRET', 'test-signing-secret');
  mocks.auth.mockResolvedValue({ organizationId: 'org', userId: 'user' }); mocks.source.mockResolvedValue(source());
  mocks.presign.mockResolvedValue('https://storage.example/upload'); mocks.inspect.mockResolvedValue(info);
  mocks.existing.mockResolvedValue(null); mocks.find.mockResolvedValue(null);
  mocks.transaction.mockImplementation(fn => fn({ deliverable: { findUnique: mocks.find, create: mocks.create }, usageEvent: { create: mocks.usage } }));
});
describe('guardado de anuncio local', () => {
  it('firma formato, cotas y procedencia; guarda otro MP4 con coste cero', async () => {
    const upload = await prepare();
    expect(readUploadTicket(upload.ticket, 'test-signing-secret')).toMatchObject({ mode: 'advertising', sourceIds: ['clip'], advertising: options, durationMs: 8000 });
    await callAction(finishAdvertisingUpload(upload.ticket));
    expect(mocks.create).toHaveBeenCalledWith({ data: expect.objectContaining({ payload: expect.objectContaining({ width: 1080, height: 1920,
      advertising: options, sourceDeliverableIds: ['clip'], dimensionPlacement: 'screen-panel', measurements: source().measurements }) }) });
    expect(mocks.usage).toHaveBeenCalledWith({ data: expect.objectContaining({ cost: '0', amount: 8 }) });
    expect(mocks.scope).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ organizationId: 'org' }), scope, { lock: true });
  });
  it('rechaza otra cuenta antes de revisar o promover el archivo', async () => {
    const upload = await prepare(); mocks.source.mockClear(); mocks.auth.mockResolvedValue({ organizationId: 'other', userId: 'other' });
    await expect(callAction(finishAdvertisingUpload(upload.ticket))).rejects.toThrow(/cuenta/);
    expect(mocks.source).not.toHaveBeenCalled(); expect(mocks.promote).not.toHaveBeenCalled();
  });
  it('revalida aprobación y duración al guardar, antes de publicar el MP4', async () => {
    const upload = await prepare(); mocks.source.mockResolvedValue({ ...source(), durationMs: 9000 });
    await expect(callAction(finishAdvertisingUpload(upload.ticket))).rejects.toThrow(/versión del clip/);
    expect(mocks.inspect).not.toHaveBeenCalled();
  });
  it('rechaza bytes fuera del límite y medidas inexistentes antes de emitir la subida', async () => {
    await expect(callAction(prepareAdvertisingUpload(scope, 'approval', 'clip', 100 * 1024 * 1024 + 1, options))).rejects.toThrow(/100 MB/);
    expect(mocks.source).not.toHaveBeenCalled();
    mocks.source.mockResolvedValue({ ...source(), measurements: null });
    await expect(prepare()).rejects.toThrow(/Sin medidas/); expect(mocks.presign).not.toHaveBeenCalled();
  });
  it('rechaza un permiso de otro modo y una cabecera falsa', async () => {
    const upload = await prepare(), ticket = readUploadTicket(upload.ticket, 'test-signing-secret');
    await expect(callAction(finishAdvertisingUpload(signUploadTicket({ ...ticket, mode: 'images' }, 'test-signing-secret')))).rejects.toThrow(/Permiso/);
    mocks.inspect.mockResolvedValue({ ...info, header: Buffer.from('<script>') });
    await expect(callAction(finishAdvertisingUpload(upload.ticket))).rejects.toThrow();
    expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.promote).not.toHaveBeenCalled();
  });
  it('repetir el guardado de un archivo ya publicado no duplica entregable ni uso', async () => {
    const upload = await prepare(); mocks.existing.mockResolvedValue({ id: 'video-existing' });
    await callAction(finishAdvertisingUpload(upload.ticket));
    expect(mocks.inspect).not.toHaveBeenCalled(); expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.usage).not.toHaveBeenCalled();
  });
});
