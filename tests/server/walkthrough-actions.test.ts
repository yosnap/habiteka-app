import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signUploadTicket } from '@/server/walkthrough/upload-ticket';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), load: vi.fn(), scope: vi.fn(), inspect: vi.fn(), promote: vi.fn(),
  existing: vi.fn(), find: vi.fn(), create: vi.fn(), usage: vi.fn(), transaction: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/server/auth/require-org-context', () => ({ requireOrgContext: mocks.auth }));
vi.mock('@/server/editor/document-repo', () => ({ withEditorDocuments: () => ({ load: mocks.load }) }));
vi.mock('@/server/editor/authority', () => ({ assertEditorScope: mocks.scope }));
vi.mock('@/server/storage/s3-storage-adapter', () => ({ getStorageAdapter: () => ({ inspect: mocks.inspect, promote: mocks.promote }) }));
vi.mock('@/server/db/prisma', () => ({ prisma: { deliverable: { findFirst: mocks.existing }, $transaction: mocks.transaction } }));
import { finishWalkthroughUpload } from '@/server/walkthrough/actions';
const claims = { id:'upload',key:'walkthrough-uploads/org/project/upload.mp4',organizationId:'org',userId:'user',projectId:'project',zoneId:null,routeId:'route',bytes:64,durationMs:10000,expires:Date.now()+300000 };
const token = () => signUploadTicket(claims,'test-signing-secret');
const info = { bytes:64,contentType:'video/mp4',header:Buffer.from('0000ftyp00000000000000000000000000') };
beforeEach(() => {
  vi.resetAllMocks();vi.stubEnv('BETTER_AUTH_SECRET','test-signing-secret');
  mocks.auth.mockResolvedValue({organizationId:'org',userId:'user'});
  mocks.load.mockResolvedValue({authority:'v2',writable:true,document:{walkthroughs:[{id:'route'}]}});
  mocks.inspect.mockResolvedValue(info);mocks.existing.mockResolvedValue(null);mocks.find.mockResolvedValue(null);
  mocks.transaction.mockImplementation((fn) => fn({deliverable:{findUnique:mocks.find,create:mocks.create},usageEvent:{create:mocks.usage}}));
});
describe('finalización de vídeos con ámbito y reintento', () => {
  it('rechaza otra organización antes de acceder al proyecto o storage', async () => {
    mocks.auth.mockResolvedValue({organizationId:'foreign',userId:'user'});
    await expect(finishWalkthroughUpload(token())).rejects.toThrow(/cuenta/);
    expect(mocks.load).not.toHaveBeenCalled();expect(mocks.inspect).not.toHaveBeenCalled();
  });
  it('revalida acceso al proyecto y ruta antes de publicar', async () => {
    mocks.load.mockRejectedValue(new Error('Fuera de ámbito'));
    await expect(finishWalkthroughUpload(token())).rejects.toThrow(/ámbito/);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it('recupera un objeto promovido tras fallo de transacción y registra coste cero', async () => {
    mocks.inspect.mockRejectedValueOnce(new Error('NoSuchKey')).mockResolvedValueOnce(info);
    await expect(finishWalkthroughUpload(token())).resolves.toEqual({id:'video-upload'});
    expect(mocks.promote).not.toHaveBeenCalled();
    expect(mocks.scope).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({organizationId:'org'}),{projectId:'project',zoneId:null},{lock:true});
    expect(mocks.usage).toHaveBeenCalledWith({data:expect.objectContaining({cost:'0',amount:10,refId:'video-upload'})});
  });
  it('registra la duración y el modo del montaje completo', async () => {
    const showcase = signUploadTicket({ ...claims, mode: 'showcase', durationMs: 18000 }, 'test-signing-secret');
    await finishWalkthroughUpload(showcase);
    expect(mocks.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      payload: expect.objectContaining({ mode: 'showcase', durationMs: 18000 }),
    }) });
    expect(mocks.usage).toHaveBeenCalledWith({ data: expect.objectContaining({ amount: 18 }) });
  });
  it('una finalización concurrente no duplica entregable ni consumo', async () => {
    mocks.find.mockResolvedValue({id:'video-upload'});
    await finishWalkthroughUpload(token());
    expect(mocks.create).not.toHaveBeenCalled();expect(mocks.usage).not.toHaveBeenCalled();
  });
  it('rechaza tipo de objeto incorrecto sin registrar entregable', async () => {
    mocks.inspect.mockResolvedValue({...info,contentType:'text/html'});
    await expect(finishWalkthroughUpload(token())).rejects.toThrow();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
