import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readUploadTicket, signUploadTicket } from '@/server/walkthrough/upload-ticket';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { PROMOTION_ROUTE_ID } from '@/lib/editor-document/promotion-video';
import { CONSTRUCTION_ROUTE_ID } from '@/lib/editor-document/native-video';
import { DEFAULT_VIDEO_PRESENTATION } from '@/lib/editor-document/video-presentation';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), readApproval: vi.fn(), scope: vi.fn(), inspect: vi.fn(), promote: vi.fn(),
  presign: vi.fn(), compile: vi.fn(), existing: vi.fn(), find: vi.fn(), create: vi.fn(), usage: vi.fn(), transaction: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/server/auth/require-org-context', () => ({ requireOrgContext: mocks.auth }));
vi.mock('@/server/editor/document-repo', () => ({ withEditorDocuments: () => ({ readApproval: mocks.readApproval }) }));
vi.mock('@/server/editor/authority', () => ({ assertEditorScope: mocks.scope }));
vi.mock('@/server/storage/s3-storage-adapter', () => ({ getStorageAdapter: () => ({ inspect: mocks.inspect, promote: mocks.promote, getPresignedUploadUrl: mocks.presign }) }));
vi.mock('@/lib/editor-document/walkthrough-geometry', () => ({ buildWalkthrough: mocks.compile }));
vi.mock('@/server/db/prisma', () => ({ prisma: { deliverable: { findFirst: mocks.existing }, $transaction: mocks.transaction } }));
import { finishWalkthroughUpload, prepareWalkthroughUpload } from '@/server/walkthrough/actions';
const claims = { id:'upload',key:'walkthrough-uploads/org/project/upload.mp4',organizationId:'org',userId:'user',projectId:'project',zoneId:null,routeId:'route',approvalId:'approval',approvedRevision:2,approvedFingerprint:'a'.repeat(64),bytes:64,durationMs:10000,expires:Date.now()+300000 };
const token = () => signUploadTicket(claims,'test-signing-secret');
const info = { bytes:64,contentType:'video/mp4',header:Buffer.from('0000ftyp00000000000000000000000000') };
beforeEach(() => {
  vi.resetAllMocks();vi.stubEnv('BETTER_AUTH_SECRET','test-signing-secret');
  mocks.auth.mockResolvedValue({organizationId:'org',userId:'user'});
  mocks.readApproval.mockResolvedValue({id:'approval',revision:2,fingerprint:'a'.repeat(64),document:{walkthroughs:[{id:'route'}]}});
  mocks.compile.mockReturnValue({durationMs:93000,invalidSegments:[]});
  mocks.presign.mockResolvedValue('https://storage.example/upload');
  mocks.inspect.mockResolvedValue(info);mocks.existing.mockResolvedValue(null);mocks.find.mockResolvedValue(null);
  mocks.transaction.mockImplementation((fn) => fn({deliverable:{findUnique:mocks.find,create:mocks.create},usageEvent:{create:mocks.usage}}));
});
describe('finalización de vídeos con ámbito y reintento', () => {
  it('firma y conserva cotas, ocultación e instrucciones Unicode sin un error de tamaño del ticket', async () => {
    mocks.readApproval.mockResolvedValue({ id: 'approval', revision: 2, fingerprint: 'a'.repeat(64),
      document: { ...emptyEditorDocument(), vertices: [{ id: 'a', x: 0, y: 0 }] } });
    const presentation = { ...DEFAULT_VIDEO_PRESENTATION, dimensionMode: 'start' as const, dimensionOcclusion: true, prompt: '建'.repeat(2000) };
    const upload = await prepareWalkthroughUpload({ projectId: 'project' }, 'approval', CONSTRUCTION_ROUTE_ID, 64, 'construction', 'all', presentation);
    expect(readUploadTicket(upload.ticket, 'test-signing-secret').presentation).toMatchObject(presentation);
    await finishWalkthroughUpload(upload.ticket);
    expect(mocks.create).toHaveBeenCalledWith({ data: expect.objectContaining({ payload: expect.objectContaining({ presentation: expect.objectContaining(presentation) }) }) });
  });
  it('rechaza presentación no válida antes de firmar o emitir una URL de subida', async () => {
    await expect(prepareWalkthroughUpload({ projectId: 'project' }, 'approval', 'route', 64, 'walkthrough', 'all', { ...DEFAULT_VIDEO_PRESENTATION, soundVolume: 8 })).rejects.toThrow();
    expect(mocks.presign).not.toHaveBeenCalled();
  });
  it('prepara y guarda construcción de 8 s sin consultar una ruta interior ni una parcela', async () => {
    mocks.readApproval.mockResolvedValue({ id: 'approval', revision: 2, fingerprint: 'a'.repeat(64),
      document: { ...emptyEditorDocument(), vertices: [{ id: 'a', x: 0, y: 0 }] } });
    const upload = await prepareWalkthroughUpload({ projectId: 'project' }, 'approval', CONSTRUCTION_ROUTE_ID, 64, 'construction');
    expect(readUploadTicket(upload.ticket, 'test-signing-secret')).toMatchObject({ mode: 'construction', durationMs: 8000, routeId: CONSTRUCTION_ROUTE_ID });
    expect(mocks.compile).not.toHaveBeenCalled();
    await finishWalkthroughUpload(upload.ticket);
    expect(mocks.create).toHaveBeenCalledWith({ data: expect.objectContaining({ payload: expect.objectContaining({ mode: 'construction', durationMs: 8000, approvedRevision: 2 }) }) });
  });
  it('firma doce segundos cuando se elige dar más tiempo al amueblado', async () => {
    mocks.readApproval.mockResolvedValue({ id: 'approval', revision: 2, fingerprint: 'a'.repeat(64),
      document: { ...emptyEditorDocument(), vertices: [{ id: 'a', x: 0, y: 0 }] } });
    const options = { ...DEFAULT_VIDEO_PRESENTATION, constructionDurationSeconds: 12 as const };
    const upload = await prepareWalkthroughUpload({ projectId: 'project' }, 'approval', CONSTRUCTION_ROUTE_ID, 64, 'construction', 'all', options);
    expect(readUploadTicket(upload.ticket, 'test-signing-secret')).toMatchObject({ durationMs: 12000, presentation: options });
    await finishWalkthroughUpload(upload.ticket);
    expect(mocks.usage).toHaveBeenCalledWith({ data: expect.objectContaining({ amount: 12, cost: '0' }) });
  });
  it('rechaza una construcción con id de ruta ajeno y sin diseño, antes de permitir la subida', async () => {
    mocks.readApproval.mockResolvedValue({ id: 'approval', revision: 2, fingerprint: 'a'.repeat(64), document: emptyEditorDocument() });
    await expect(prepareWalkthroughUpload({ projectId: 'project' }, 'approval', CONSTRUCTION_ROUTE_ID, 64, 'construction')).rejects.toThrow('Falta el diseño');
    mocks.readApproval.mockResolvedValue({ id: 'approval', revision: 2, fingerprint: 'a'.repeat(64), document: { ...emptyEditorDocument(), vertices: [{ id: 'a', x: 0, y: 0 }] } });
    await expect(prepareWalkthroughUpload({ projectId: 'project' }, 'approval', 'route', 64, 'construction')).rejects.toThrow('Falta el diseño');
    expect(mocks.presign).not.toHaveBeenCalled();
    await expect(finishWalkthroughUpload(signUploadTicket({ ...claims, mode: 'construction', durationMs: 30000 }, 'test-signing-secret'))).rejects.toThrow('versión aprobada');
    expect(mocks.inspect).not.toHaveBeenCalled();
  });
  const promotionDocument = () => ({ ...emptyEditorDocument(), vertices: [{ id: 'a', x: 0, y: 0 }],
    geographicSite: { source: 'IGN-PNOA', latitude: 40.7, longitude: -3.5, groundWidthM: 180,
      assetKey: 'geographic-sites/org/project/00000000-0000-4000-8000-000000000000.jpg',
      capturedAt: '2026-09-30T10:00:00.000Z', anchor: { x: .5, y: .5 }, planOriginMm: { x: 0, y: 0 },
      rotationDeg: 0, intervention: [{ x: .2, y: .2 }, { x: .8, y: .2 }, { x: .8, y: .8 }],
      scenario: 'reconstruction', lighting: 'afternoon', confirmed: true } });
  it('prepares a promotion from a confirmed approved site without an interior route', async () => {
    mocks.readApproval.mockResolvedValue({ id: 'approval', revision: 2, fingerprint: 'a'.repeat(64), document: promotionDocument() });
    const result = await prepareWalkthroughUpload({ projectId: 'project' }, 'approval', PROMOTION_ROUTE_ID, 1024, 'promotion');
    expect(readUploadTicket(result.ticket, 'test-signing-secret')).toMatchObject({ mode: 'promotion', durationMs: 30000 });
    expect(mocks.compile).not.toHaveBeenCalled();
  });
  it('refuses promotion before placement is confirmed, before signing an upload', async () => {
    const document = promotionDocument(); document.geographicSite.confirmed = false;
    mocks.readApproval.mockResolvedValue({ id: 'approval', revision: 2, fingerprint: 'a'.repeat(64), document });
    await expect(prepareWalkthroughUpload({ projectId: 'project' }, 'approval', PROMOTION_ROUTE_ID, 1024, 'promotion')).rejects.toThrow(/confirma/);
    expect(mocks.presign).not.toHaveBeenCalled();
  });
  it('saves the approved geographic placement and light in promotion metadata', async () => {
    const document = promotionDocument();
    mocks.readApproval.mockResolvedValue({ id: 'approval', revision: 2, fingerprint: 'a'.repeat(64), document });
    await finishWalkthroughUpload(signUploadTicket({ ...claims, routeId: PROMOTION_ROUTE_ID, mode: 'promotion', durationMs: 30000 }, 'test-signing-secret'));
    expect(mocks.create).toHaveBeenCalledWith({ data: expect.objectContaining({ payload: expect.objectContaining({
      mode: 'promotion', durationMs: 30000, geographicSite: document.geographicSite,
    }) }) });
  });
  it('prepara el MP4 largo desde la ruta aprobada y conserva su duración exacta', async () => {
    const upload = await prepareWalkthroughUpload({projectId:'project'}, 'approval', 'route', 1024, 'showcase');
    expect(readUploadTicket(upload.ticket, 'test-signing-secret').durationMs).toBe(101000);
    expect(upload.url).toBe('https://storage.example/upload');
    expect(mocks.presign).toHaveBeenCalledWith(expect.stringContaining('/project/'), 1024, 'video/mp4');
  });
  it('rechaza el montaje cuando la introducción supera los 110 s', async () => {
    mocks.compile.mockReturnValue({durationMs:103000,invalidSegments:[]});
    await expect(prepareWalkthroughUpload({projectId:'project'}, 'approval', 'route', 1024, 'showcase')).rejects.toThrow(/máximo/);
    expect(mocks.presign).not.toHaveBeenCalled();
  });
  it('rechaza otra organización antes de acceder al proyecto o storage', async () => {
    mocks.auth.mockResolvedValue({organizationId:'foreign',userId:'user'});
    await expect(finishWalkthroughUpload(token())).rejects.toThrow(/cuenta/);
    expect(mocks.readApproval).not.toHaveBeenCalled();expect(mocks.inspect).not.toHaveBeenCalled();
  });
  it('revalida acceso al proyecto y ruta antes de publicar', async () => {
    mocks.readApproval.mockRejectedValue(new Error('Fuera de ámbito'));
    await expect(finishWalkthroughUpload(token())).rejects.toThrow(/ámbito/);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it('rechaza una versión aprobada distinta antes de publicar', async () => {
    mocks.readApproval.mockResolvedValue({id:'approval',revision:3,fingerprint:'b'.repeat(64),document:{walkthroughs:[{id:'route'}]}});
    await expect(finishWalkthroughUpload(token())).rejects.toThrow(/versión aprobada/);
    expect(mocks.inspect).not.toHaveBeenCalled();
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
      payload: expect.objectContaining({ mode: 'showcase', durationMs: 18000, approvalId: 'approval', approvedRevision: 2 }),
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
