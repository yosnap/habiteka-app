'use server';
import { requireOrgContext } from '@/server/auth/require-org-context';
import { assertEditorScope, type EditorScope } from '@/server/editor/authority';
import { prisma } from '@/server/db/prisma';
import { designConstructionPrompt, designVideoEstimate, designVideoSettingsSchema, DESIGN_VIDEO_MODEL,
  type DesignVideoSettings, type DesignVideoJob } from '@/lib/editor-document/design-video';
import { designVideoSources } from './design-video-sources';
import { jobJson, readDesignVideoJob, updateDesignVideoJob } from './design-video-jobs';
import { resolveKieKey } from '@/server/ai/provider-key-resolver';
import { KieVideoProvider, KieSubmissionUnknownError } from '@/server/ai/video/kie-video';
import { readRenderReference } from '@/server/agent/editor-v2/render-asset-reader';
import { getStorageAdapter } from '@/server/storage/s3-storage-adapter';
import { hold, settle, revert } from '@/server/billing/credit-hold';
import { assertCanSpend, recordOutcome } from '@/server/ai/guard/spend-guard';
import { assertGlobalCap } from '@/server/billing/global-cap';
import { canUse, isPremium } from '@/server/billing/gating';
import { constructionTiming } from '@/lib/editor-document/construction-timing';
import { DELIVERABLE_LEGAL_SEAL } from '@/lib/legal-text';
import { designVideoStructure } from '@/lib/editor-document/design-video-structure';
import { videoTitleSchema } from '@/lib/editor-document/video-title';
import { designVisitPrompt, designVisitSelectionIssue } from '@/lib/editor-document/design-visit';
import { getChatVisionAdapter } from '@/server/ai';
import { englishImagePrompt } from '@/server/agent/editor-v2/english-image-prompt';
import { withEditorDocuments } from '@/server/editor/document-repo';
import { assertStandaloneVideoBudget } from './property-visit-budget';

const H3_PROMPT_LIMIT = 7000;

export async function loadDesignVideoReferences(scope: EditorScope, approvalId?: string) {
  const ctx = await requireOrgContext();
  await prisma.$transaction(tx => assertEditorScope(tx, ctx, scope));
  const sources = await designVideoSources(ctx, scope, approvalId);
  const approvals = await withEditorDocuments(ctx).listApprovals(scope);
  const credential = await prisma.aiProviderCredential.findUnique({ where: { provider: 'kie' }, select: { enabled: true } });
  return { references: sources.references, approvalId: sources.approved?.id ?? null,
    approvals, revision: sources.approved?.revision, lighting: sources.approved?.lightingPreset, providerReady: credential?.enabled === true };
}

/** Preparar solo lee medios propios y guarda un presupuesto; no sube referencias ni llama a KIE. */
export async function prepareDesignConstruction(scope: EditorScope, approvalId: string, ids: string[], input: DesignVideoSettings, name?: string) {
  return prepareDesignVideo(scope, approvalId, ids, input, name, 'construction-ai');
}

export async function prepareDesignVisit(scope: EditorScope, approvalId: string, ids: string[], input: DesignVideoSettings, name?: string) {
  return prepareDesignVideo(scope, approvalId, ids, input, name, 'walkthrough-ai');
}

async function prepareDesignVideo(scope: EditorScope, approvalId: string, ids: string[], input: DesignVideoSettings, name: string | undefined, mode: DesignVideoJob['mode']) {
  const ctx = await requireOrgContext(), settings = designVideoSettingsSchema.parse(input);
  const title = videoTitleSchema.parse(name);
  const sources = await designVideoSources(ctx, scope, approvalId, ids, mode), approved = sources.approved!;
  assertDesignReferences(sources, mode);
  // El piloto aún no compone medidas exactas sobre una cámara generada por IA.
  settings.presentation = { ...settings.presentation, contentScope: 'all', showDimensions: false, dimensionMode: 'none' };
  const structuralConstraints = mode === 'construction-ai' ? designVideoStructure(approved.document, sources.rows.map(row => ({ view: row.payload.generation?.view, options: row.options }))) : undefined;
  const prompt = mode === 'construction-ai' ? designConstructionPrompt(approved.lightingPreset, settings, sources.references, structuralConstraints)
    : designVisitPrompt(settings, sources.references);
  if (prompt.length > H3_PROMPT_LIMIT) throw new Error('El guion supera el límite de H3. Acorta tus indicaciones antes de preparar.');
  const estimate = designVideoEstimate(settings, ids.length), id = crypto.randomUUID();
  const job: DesignVideoJob = { type: 'video', mode, status: 'prepared', provider: 'kie', model: DESIGN_VIDEO_MODEL,
    approvalId, approvedRevision: approved.revision, approvedFingerprint: approved.fingerprint, sourceIds: ids,
    sourceScopes: sources.rows.map(row => ({ id: row.id, options: row.options })),
    includedZones: [...new Set(sources.references.flatMap(reference => mode === 'walkthrough-ai' ? [reference.interiorRoomName!] : reference.zones))], prompt, settings, structuralConstraints,
    durationMs: constructionTiming(settings.presentation).durationMs, estimateUsd: estimate.usd, credits: estimate.credits, ...(title ? { title } : {}) };
  await prisma.$transaction(async tx => {
    await assertEditorScope(tx, ctx, scope, { lock: true });
    await tx.deliverable.create({ data: { id, projectId: scope.projectId, zoneId: scope.zoneId ?? null, type: 'VIDEO', payload: jobJson(job), legalSeal: DELIVERABLE_LEGAL_SEAL } });
  });
  return { id, job };
}

/** Requiere confirmación del importe y de los medios concretos ya preparados. Un intento por preparación. */
export async function startDesignConstruction(scope: EditorScope, id: string, consent: { referencesToKie: boolean; maxUsd: number }) {
  const ctx = await requireOrgContext(), row = await readDesignVideoJob(ctx, scope, id), job = row.job;
  if (job.status !== 'prepared') throw new Error('Esta prueba ya se ha enviado o terminó. Consulta su estado; no se relanzará.');
  if (consent.referencesToKie !== true || !Number.isFinite(consent.maxUsd) || consent.maxUsd < job.estimateUsd)
    throw new Error('Confirma las imágenes enviadas a KIE/MiniMax y su presupuesto antes de generar.');
  await assertStandaloneVideoBudget(job.estimateUsd, job.durationMs);
  const sources = await designVideoSources(ctx, scope, job.approvalId, job.sourceIds, job.mode);
  assertDesignReferences(sources, job.mode);
  if (sources.approved?.fingerprint !== job.approvedFingerprint) throw new Error('La aprobación cambió. Prepara otra prueba con la versión correcta.');
  if (!(await canUse(ctx.organizationId, 'generate')).allowed) throw new Error('Necesitas saldo de créditos para generar el vídeo.');
  await assertGlobalCap(await isPremium(ctx.organizationId));
  const provider = new KieVideoProvider(await resolveKieKey());
  let version = await updateDesignVideoJob(ctx, scope, id, row.version, { ...job, status: 'submitting' });
  const holdId = `design-video:${id}`; let reserved = false, submitted = false, taskId: string | undefined;
  let sent: Pick<DesignVideoJob, 'sentPrompt' | 'promptTranslationIssue'> = {};
  try {
    assertCanSpend(ctx.organizationId, job.estimateUsd);
    await hold({ idempotencyKey: holdId, organizationId: ctx.organizationId, amount: job.credits, refType: 'design-video', refId: id, ttlMinutes: 1440 }); reserved = true;
    const english = await englishVideoPrompt(ctx, scope.projectId, id, job.prompt);
    sent = english.record;
    const urls: string[] = [];
    // La transferencia ocurre solo después de la confirmación. Se sanea cada imagen propia antes de subirla.
    for (const source of sources.rows) urls.push(await provider.uploadReference(await readRenderReference(source.payload)));
    submitted = true;
    taskId = await provider.create(english.prompt, job.settings, urls);
    // Guardar la recuperación antes del saldo: un fallo contable no debe perder una tarea ya aceptada.
    version = await updateDesignVideoJob(ctx, scope, id, version, { ...job, ...sent, status: 'generating', taskId });
    await reconcileDesignVideoCost(ctx, id, job);
    recordOutcome(ctx.organizationId, true);
    return { status: 'generating' as const, taskId };
  } catch (error) {
    const uncertain = error instanceof KieSubmissionUnknownError || Boolean(taskId);
    let message = error instanceof Error ? error.message : 'No se pudo iniciar la prueba.';
    const status = uncertain ? 'unknown' : 'failed';
    // Una respuesta dudosa puede haber consumido saldo: queda retenida y visible, nunca se reintenta createTask.
    await updateDesignVideoJob(ctx, scope, id, version, { ...job, ...sent, status, ...(taskId ? { taskId } : {}), error: message });
    if (reserved) {
      try { if (uncertain) await settle(holdId); else await revert(holdId); }
      catch { message += ' El saldo sigue pendiente de conciliación; conserva esta tarea.'; }
    }
    recordOutcome(ctx.organizationId, false);
    throw new Error(`${message}${submitted && uncertain ? ' Revisa esta tarea; no prepares otro intento todavía.' : ''}`);
  }
}

/**
 * El guion se muestra en español y se envía en inglés, como los prompts de imagen. Si la traducción falla o supera el
 * límite de H3, se envía el original; el vídeo nunca se bloquea por ello.
 */
async function englishVideoPrompt(ctx: Awaited<ReturnType<typeof requireOrgContext>>, projectId: string, id: string, prompt: string) {
  const english = await getChatVisionAdapter({ organizationId: ctx.organizationId, userId: ctx.userId, projectId, refId: id }, 'vision')
    .then(vision => englishImagePrompt(vision, prompt))
    .catch((error: unknown) => ({ prompt, translated: false, issue: error instanceof Error ? error.message.slice(0, 200) : 'sin modelo de análisis visual' }));
  if (english.translated && english.prompt.length > H3_PROMPT_LIMIT) return { prompt, record: { promptTranslationIssue: 'la traducción supera el límite de H3' } };
  return { prompt: english.prompt, record: english.translated ? { sentPrompt: english.prompt } : english.issue ? { promptTranslationIssue: english.issue } : {} };
}

/** Ambas escrituras son idempotentes; consultar recupera también un registro de coste interrumpido. */
async function reconcileDesignVideoCost(ctx: Awaited<ReturnType<typeof requireOrgContext>>, id: string, job: DesignVideoJob) {
  await prisma.usageEvent.upsert({ where: { id: `design-video:${id}` }, create: { id: `design-video:${id}`, orgId: ctx.organizationId,
    userId: ctx.userId, action: 'video.kie-h3.estimated', unit: 'second', amount: job.durationMs / 1000, cost: job.estimateUsd, refId: id }, update: {} });
  await settle(`design-video:${id}`);
}

function assertConstructionReferences(sources: Awaited<ReturnType<typeof designVideoSources>>) {
  if (!sources.rows.some(row => !row.options.interiorRoomIds.length && ['top', 'isometric', 'drone'].includes(row.payload.generation?.view?.preset ?? '')))
    throw new Error('Elige una cenital, isométrica o dron del diseño para fijar el conjunto y su distribución.');
  if (!sources.references.some(reference => reference.closedRoof))
    throw new Error('Añade Exterior terminado del mismo diseño y tanda, o pulsa «Cerrar tejado desde el modelo» en su isométrica o dron aceptados, antes de preparar la construcción.');
  const batches = new Set(sources.references.map(reference => reference.batchId));
  if (batches.size !== 1 || batches.has(null)) throw new Error('Para el piloto elige referencias de una misma tanda. No se mezclarán diseños distintos.');
}

function assertDesignReferences(sources: Awaited<ReturnType<typeof designVideoSources>>, mode: DesignVideoJob['mode']) {
  if (mode === 'construction-ai') return assertConstructionReferences(sources);
  const issue = designVisitSelectionIssue(sources.references);
  if (issue) throw new Error(issue);
}

export async function checkDesignConstruction(scope: EditorScope, id: string) {
  const ctx = await requireOrgContext(), row = await readDesignVideoJob(ctx, scope, id), job = row.job;
  if (!job.taskId || !['generating', 'unknown'].includes(job.status)) return { id, job, url: job.assetKey ? await getStorageAdapter().getPresignedDownloadUrl(job.assetKey) : null };
  await reconcileDesignVideoCost(ctx, id, job);
  const provider = new KieVideoProvider(await resolveKieKey()), result = await provider.status(job.taskId);
  if (result.state === 'pending') return { id, job, url: null };
  const next: DesignVideoJob = result.state === 'failed' ? { ...job, status: 'failed', error: 'KIE informa que la generación falló. Revisa el saldo del proveedor antes de otro intento.' }
    : { ...job, status: 'review', assetKey: `videos/${ctx.organizationId}/${scope.projectId}/${id}.mp4`, error: undefined };
  if (result.state === 'success') await getStorageAdapter().put({ key: next.assetKey!, body: await provider.download(result.resultUrl!), contentType: 'video/mp4' });
  await updateDesignVideoJob(ctx, scope, id, row.version, next);
  return { id, job: next, url: next.assetKey ? await getStorageAdapter().getPresignedDownloadUrl(next.assetKey) : null };
}

export async function reviewDesignConstruction(scope: EditorScope, id: string, accepted: boolean) {
  const ctx = await requireOrgContext(), row = await readDesignVideoJob(ctx, scope, id);
  if (row.job.status !== 'review') throw new Error('Consulta y revisa el vídeo terminado antes de aceptarlo o rechazarlo.');
  await updateDesignVideoJob(ctx, scope, id, row.version, { ...row.job, status: accepted ? 'accepted' : 'rejected' });
}

/** Cambiar una preparación no enviada conserva el borrado reversible y no deja un presupuesto antiguo enviable. */
export async function discardDesignPreparation(scope: EditorScope, id: string) {
  const ctx = await requireOrgContext(), row = await readDesignVideoJob(ctx, scope, id);
  if (row.job.status !== 'prepared') throw new Error('Una prueba ya enviada no puede modificarse. Consulta su resultado.');
  await prisma.$transaction(async tx => {
    await assertEditorScope(tx, ctx, scope, { lock: true });
    const changed = await tx.deliverable.updateMany({ where: { id, version: row.version, projectId: scope.projectId, zoneId: scope.zoneId ?? null, deletedAt: null },
      data: { deletedAt: new Date(), version: { increment: 1 } } });
    if (changed.count !== 1) throw new Error('La prueba cambió en otra pestaña. Actualiza su estado.');
  });
}
