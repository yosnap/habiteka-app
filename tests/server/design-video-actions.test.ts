import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_VIDEO_PRESENTATION } from '@/lib/editor-document/video-presentation';
import type { DesignVideoJob } from '@/lib/editor-document/design-video';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { defaultRenderDesignOptions } from '@/lib/editor-document/render-design-options';
const mock = vi.hoisted(() => ({ auth: vi.fn(), sources: vi.fn(), read: vi.fn(), update: vi.fn(), transaction: vi.fn(), createRow: vi.fn(),
  hold: vi.fn(), settle: vi.fn(), revert: vi.fn(), key: vi.fn(), access: vi.fn(), premium: vi.fn(), cap: vi.fn(), spend: vi.fn(), outcome: vi.fn(),
  readReference: vi.fn(), upload: vi.fn(), create: vi.fn(), status: vi.fn(), download: vi.fn(), put: vi.fn(), url: vi.fn(), usage: vi.fn(), scope: vi.fn(), deletePrepared: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/server/auth/require-org-context', () => ({ requireOrgContext: mock.auth }));
vi.mock('@/server/editor/authority', () => ({ assertEditorScope: mock.scope }));
vi.mock('@/server/db/prisma', () => ({ prisma: { $transaction: mock.transaction, usageEvent: { upsert: mock.usage } } }));
vi.mock('@/server/walkthrough/design-video-sources', () => ({ designVideoSources: mock.sources }));
vi.mock('@/server/walkthrough/design-video-jobs', () => ({ jobJson: (job: unknown) => job, readDesignVideoJob: mock.read, updateDesignVideoJob: mock.update }));
vi.mock('@/server/ai/provider-key-resolver', () => ({ resolveKieKey: mock.key }));
vi.mock('@/server/ai/video/kie-video', async importOriginal => {
  const actual = await importOriginal<typeof import('@/server/ai/video/kie-video')>();
  return { ...actual, KieVideoProvider: class { uploadReference = mock.upload; create = mock.create; status = mock.status; download = mock.download; } };
});
vi.mock('@/server/agent/editor-v2/render-asset-reader', () => ({ readRenderReference: mock.readReference }));
vi.mock('@/server/storage/s3-storage-adapter', () => ({ getStorageAdapter: () => ({ put: mock.put, getPresignedDownloadUrl: mock.url }) }));
vi.mock('@/server/billing/credit-hold', () => ({ hold: mock.hold, settle: mock.settle, revert: mock.revert }));
vi.mock('@/server/billing/gating', () => ({ canUse: mock.access, isPremium: mock.premium }));
vi.mock('@/server/billing/global-cap', () => ({ assertGlobalCap: mock.cap }));
vi.mock('@/server/ai/guard/spend-guard', () => ({ assertCanSpend: mock.spend, recordOutcome: mock.outcome }));
import { prepareDesignConstruction, prepareDesignVisit, startDesignConstruction, checkDesignConstruction, discardDesignPreparation } from '@/server/walkthrough/design-video-actions';
import { KieSubmissionUnknownError, KieSubmissionRejectedError } from '@/server/ai/video/kie-video';
const scope = { projectId: 'project', zoneId: 'zone' };
const settings = { presentation: DEFAULT_VIDEO_PRESENTATION, resolution: '768P' as const };
const job = (): DesignVideoJob => ({ type: 'video', mode: 'construction-ai', status: 'prepared', provider: 'kie', model: 'minimax-h3/reference-to-video',
  approvalId: 'approval', approvedRevision: 7, approvedFingerprint: 'fingerprint', sourceIds: ['design'], sourceScopes: [], includedZones: ['Patio', 'Rampa'],
  prompt: 'Usar los muebles del diseño', settings, durationMs: 8000, estimateUsd: .32, credits: 32 });
beforeEach(() => {
  vi.resetAllMocks(); mock.auth.mockResolvedValue({ userId: 'user', organizationId: 'org' });
  mock.read.mockResolvedValue({ version: 1, job: job() }); mock.update.mockResolvedValue(2);
  mock.sources.mockResolvedValue({ approved: { id: 'approval', revision: 7, fingerprint: 'fingerprint', lightingPreset: 'daylight', document: emptyEditorDocument() },
    rows: [{ id: 'design', payload: { generation: { view: { preset: 'top' } } }, options: { ...defaultRenderDesignOptions(), regions: [{ name: 'Patio' }, { name: 'Rampa' }] } }],
    references: [{ id: 'design', batchId: 'batch', name: 'Conjunto', view: 'Cenital', zones: ['Patio', 'Rampa'], closedRoof: false },
      { id: 'roof', batchId: 'batch', name: 'Conjunto', view: 'Exterior terminado', zones: ['Patio', 'Rampa'], closedRoof: true }] });
  mock.transaction.mockImplementation(fn => fn({ deliverable: { create: mock.createRow, updateMany: mock.deletePrepared } }));
  mock.deletePrepared.mockResolvedValue({ count: 1 });
  mock.access.mockResolvedValue({ allowed: true }); mock.key.mockResolvedValue('key'); mock.upload.mockResolvedValue('https://example.com/design.png');
  mock.create.mockResolvedValue('task'); mock.status.mockResolvedValue({ state: 'pending' }); mock.url.mockResolvedValue('https://storage.example/video.mp4');
});
describe('piloto de construcción desde diseños', () => {
  it('prepara primera persona solo con interior verificado, sin reserva ni transferencia', async () => {
    const sources = await mock.sources();
    sources.references = [{ id: 'design', batchId: 'batch', name: 'Salón', view: 'Interior', zones: ['Salón'], closedRoof: true,
      interiorRoomId: 'ground:salon', interiorRoomName: 'Salón' }];
    mock.sources.mockResolvedValue(sources);
    const result = await prepareDesignVisit(scope, 'approval', ['design'], settings, 'Interior del salón');
    expect(result.job).toMatchObject({ mode: 'walkthrough-ai', title: 'Interior del salón', includedZones: ['Salón'], durationMs: 8000, estimateUsd: .32 });
    expect(result.job.prompt).toContain('no mostrar construcción');
    expect(result.job.structuralConstraints).toBeUndefined();
    expect(mock.create).not.toHaveBeenCalled(); expect(mock.upload).not.toHaveBeenCalled(); expect(mock.hold).not.toHaveBeenCalled();
    mock.read.mockResolvedValue({ version: 1, job: result.job });
    await startDesignConstruction(scope, 'visit', { referencesToKie: true, maxUsd: .32 });
    expect(mock.create).toHaveBeenCalledWith(result.job.prompt, result.job.settings, ['https://example.com/design.png']);
  });
  it('revalida referencias de primera persona al enviar y bloquea cambios antes de reserva o subida', async () => {
    mock.read.mockResolvedValue({ version: 1, job: { ...job(), mode: 'walkthrough-ai' } });
    await expect(prepareDesignVisit(scope, 'approval', ['design'], settings)).rejects.toThrow('estancia interior');
    await expect(startDesignConstruction(scope, 'visit', { referencesToKie: true, maxUsd: .32 })).rejects.toThrow('estancia interior');
    expect(mock.createRow).not.toHaveBeenCalled(); expect(mock.key).not.toHaveBeenCalled(); expect(mock.hold).not.toHaveBeenCalled(); expect(mock.upload).not.toHaveBeenCalled();
  });
  it('bloquea preparación sin cubierta terminada antes de guardar, reservar o enviar', async () => {
    mock.sources.mockResolvedValue({ approved: { document: emptyEditorDocument() },
      rows: [{ payload: { generation: { view: { preset: 'top' } } }, options: defaultRenderDesignOptions() }],
      references: [{ closedRoof: false }] });
    await expect(prepareDesignConstruction(scope, 'approval', ['design'], settings)).rejects.toThrow('Añade Exterior terminado');
    await expect(startDesignConstruction(scope, 'job', { referencesToKie: true, maxUsd: .32 })).rejects.toThrow('Añade Exterior terminado');
    expect(mock.createRow).not.toHaveBeenCalled(); expect(mock.hold).not.toHaveBeenCalled(); expect(mock.upload).not.toHaveBeenCalled();
  });
  it('permite modificar una preparación con borrado reversible, pero bloquea tareas enviadas y cambios concurrentes', async () => {
    await discardDesignPreparation(scope, 'job');
    expect(mock.scope).toHaveBeenCalledWith(expect.anything(), expect.anything(), scope, { lock: true });
    expect(mock.deletePrepared).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'job', version: 1, projectId: 'project', zoneId: 'zone', deletedAt: null }),
      data: { deletedAt: expect.any(Date), version: { increment: 1 } } }));
    mock.deletePrepared.mockResolvedValueOnce({ count: 0 });
    await expect(discardDesignPreparation(scope, 'job')).rejects.toThrow('otra pestaña');
    mock.read.mockResolvedValueOnce({ version: 2, job: { ...job(), status: 'generating', taskId: 'task' } });
    await expect(discardDesignPreparation(scope, 'job')).rejects.toThrow('ya enviada');
    expect(mock.deletePrepared).toHaveBeenCalledTimes(2);
    expect(mock.create).not.toHaveBeenCalled(); expect(mock.hold).not.toHaveBeenCalled();
  });
  it('prepara ámbito y guion sin transferencias ni consumo y congela las opciones de las imágenes', async () => {
    const result = await prepareDesignConstruction(scope, 'approval', ['design'], settings, '  Construcción del diseño  ');
    expect(result.job).toMatchObject({ status: 'prepared', title: 'Construcción del diseño', includedZones: ['Patio', 'Rampa'], durationMs: 8000, estimateUsd: .32,
      sourceScopes: [{ id: 'design', options: expect.objectContaining({ regions: [{ name: 'Patio' }, { name: 'Rampa' }] }) }] });
    expect(result.job.structuralConstraints).toContain('No añadir, duplicar, desplazar');
    expect(result.job.settings.presentation.showDimensions).toBe(false);
    expect(mock.create).not.toHaveBeenCalled(); expect(mock.upload).not.toHaveBeenCalled(); expect(mock.hold).not.toHaveBeenCalled();
  });
  it('bloquea sin consentimiento o presupuesto antes de descifrar claves y reservar', async () => {
    for (const consent of [{ referencesToKie: false, maxUsd: .32 }, { referencesToKie: true, maxUsd: .1 }])
      await expect(startDesignConstruction(scope, 'job', consent)).rejects.toThrow('Confirma');
    expect(mock.key).not.toHaveBeenCalled(); expect(mock.hold).not.toHaveBeenCalled(); expect(mock.create).not.toHaveBeenCalled();
  });
  it('revalida fotos antiguas al enviar una preparación y bloquea antes de reserva, credenciales o transferencia', async () => {
    mock.sources.mockRejectedValue(new Error('Trasera: esta vista oculta tabiques interiores'));
    await expect(startDesignConstruction(scope, 'job', { referencesToKie: true, maxUsd: .32 })).rejects.toThrow('tabiques interiores');
    expect(mock.update).not.toHaveBeenCalled(); expect(mock.key).not.toHaveBeenCalled(); expect(mock.hold).not.toHaveBeenCalled();
    expect(mock.upload).not.toHaveBeenCalled(); expect(mock.create).not.toHaveBeenCalled();
  });
  it('un segundo envío o una reclamación concurrente nunca crea otra tarea', async () => {
    mock.read.mockResolvedValueOnce({ version: 2, job: { ...job(), status: 'generating', taskId: 'task' } });
    await expect(startDesignConstruction(scope, 'job', { referencesToKie: true, maxUsd: .32 })).rejects.toThrow('ya');
    mock.update.mockRejectedValueOnce(new Error('otra pestaña'));
    await expect(startDesignConstruction(scope, 'job', { referencesToKie: true, maxUsd: .32 })).rejects.toThrow('otra pestaña');
    expect(mock.create).not.toHaveBeenCalled(); expect(mock.upload).not.toHaveBeenCalled();
  });
  it('un error ambiguo mantiene el gasto reservado y no repite createTask; un rechazo confirmado libera', async () => {
    mock.create.mockRejectedValueOnce(new KieSubmissionUnknownError('sin confirmar'));
    await expect(startDesignConstruction(scope, 'job', { referencesToKie: true, maxUsd: .32 })).rejects.toThrow('sin confirmar');
    expect(mock.settle).toHaveBeenCalledWith('design-video:job'); expect(mock.revert).not.toHaveBeenCalled();
    expect(mock.update).toHaveBeenLastCalledWith(expect.anything(), scope, 'job', 2, expect.objectContaining({ status: 'unknown' }));
    expect(mock.create).toHaveBeenCalledTimes(1);
    mock.create.mockRejectedValueOnce(new KieSubmissionRejectedError('rechazó'));
    await expect(startDesignConstruction(scope, 'other', { referencesToKie: true, maxUsd: .32 })).rejects.toThrow('rechazó');
    expect(mock.revert).toHaveBeenCalledWith('design-video:other');
  });
  it('guarda el identificador de tarea y reserva antes de transferir imágenes', async () => {
    expect(await startDesignConstruction(scope, 'job', { referencesToKie: true, maxUsd: .32 })).toEqual({ status: 'generating', taskId: 'task' });
    expect(mock.hold.mock.invocationCallOrder[0]).toBeLessThan(mock.upload.mock.invocationCallOrder[0]!);
    expect(mock.update).toHaveBeenLastCalledWith(expect.anything(), scope, 'job', 2, expect.objectContaining({ taskId: 'task', status: 'generating' }));
    expect(mock.usage).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ cost: .32, action: 'video.kie-h3.estimated' }) }));
    expect(mock.update.mock.invocationCallOrder[1]).toBeLessThan(mock.usage.mock.invocationCallOrder[0]!);
  });
  it('conserva la tarea cuando fallan la liquidación y su limpieza; consultar la recupera sin generar otra', async () => {
    mock.settle.mockRejectedValue(new Error('saldo no disponible'));
    await expect(startDesignConstruction(scope, 'job', { referencesToKie: true, maxUsd: .32 }))
      .rejects.toThrow('pendiente de conciliación');
    expect(mock.update).toHaveBeenLastCalledWith(expect.anything(), scope, 'job', 2,
      expect.objectContaining({ status: 'unknown', taskId: 'task' }));
    expect(mock.create).toHaveBeenCalledTimes(1);
    expect(mock.revert).not.toHaveBeenCalled();
    mock.settle.mockResolvedValue(undefined);
    mock.read.mockResolvedValue({ version: 3, job: { ...job(), status: 'unknown', taskId: 'task' } });
    await checkDesignConstruction(scope, 'job');
    expect(mock.status).toHaveBeenCalledWith('task');
    expect(mock.create).toHaveBeenCalledTimes(1);
  });
  it('conserva el identificador si falla el registro de uso y lo concilia al consultar', async () => {
    mock.usage.mockRejectedValueOnce(new Error('registro de uso no disponible'));
    await expect(startDesignConstruction(scope, 'job', { referencesToKie: true, maxUsd: .32 }))
      .rejects.toThrow('registro de uso');
    expect(mock.update).toHaveBeenLastCalledWith(expect.anything(), scope, 'job', 2,
      expect.objectContaining({ status: 'unknown', taskId: 'task' }));
    mock.read.mockResolvedValue({ version: 3, job: { ...job(), status: 'unknown', taskId: 'task' } });
    await checkDesignConstruction(scope, 'job');
    expect(mock.usage).toHaveBeenCalledTimes(2);
    expect(mock.status).toHaveBeenCalledWith('task');
    expect(mock.create).toHaveBeenCalledTimes(1);
  });
  it('recupera y archiva un resultado ya cobrado y exige revisión sin relanzar', async () => {
    mock.read.mockResolvedValue({ version: 2, job: { ...job(), status: 'generating', taskId: 'task' } });
    mock.status.mockResolvedValue({ state: 'success', resultUrl: 'https://example.com/video.mp4' }); mock.download.mockResolvedValue(Buffer.from('mp4'));
    const result = await checkDesignConstruction(scope, 'job');
    expect(result.job).toMatchObject({ status: 'review', assetKey: 'videos/org/project/job.mp4' });
    expect(mock.put).toHaveBeenCalled(); expect(mock.create).not.toHaveBeenCalled(); expect(mock.hold).not.toHaveBeenCalled();
  });
  it('conserva la tarea al fallar la descarga, para recuperarla sin pagar otro vídeo', async () => {
    mock.read.mockResolvedValue({ version: 2, job: { ...job(), status: 'generating', taskId: 'task' } });
    mock.status.mockResolvedValue({ state: 'success', resultUrl: 'https://example.com/video.mp4' }); mock.download.mockRejectedValue(new Error('download'));
    await expect(checkDesignConstruction(scope, 'job')).rejects.toThrow('download');
    expect(mock.update).not.toHaveBeenCalled(); expect(mock.create).not.toHaveBeenCalled();
  });
});
