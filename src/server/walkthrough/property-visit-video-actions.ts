'use server';
import { requireOrgContext } from '@/server/auth/require-org-context';
import { normalizeEditorScope, type EditorScope } from '@/server/editor/authority';
import { readPropertyVisit, updatePropertyVisit } from './property-visit-repo';
import { propertyVisitAcceptedFrames } from './property-visit-sources';
import { propertyVisitSegmentPrice, propertyVisitSegmentPrompt, PROPERTY_VISIT_COMPACT_MODEL } from '@/lib/editor-document/property-visit-job';
import { resolveKieKey } from '@/server/ai/provider-key-resolver';
import { KieVideoProvider, KieSubmissionUnknownError } from '@/server/ai/video/kie-video';
import { readRenderReference } from '@/server/agent/editor-v2/render-asset-reader';
import { getStorageAdapter } from '@/server/storage/s3-storage-adapter';
import { hold, settle, revert } from '@/server/billing/credit-hold';
import { assertCanSpend, recordOutcome } from '@/server/ai/guard/spend-guard';
import { assertGlobalCap } from '@/server/billing/global-cap';
import { canUse, isPremium } from '@/server/billing/gating';
import { prisma } from '@/server/db/prisma';
import { assertPropertyVisitBudget } from './property-visit-budget';

export async function startPropertyVisitSegment(rawScope: EditorScope, id: string, segmentId: string,
  consent: { referencesToKie: boolean; maxUsd: number; onlyThisSegment?: boolean }) {
  const scope = normalizeEditorScope(rawScope), ctx = await requireOrgContext(), row = await readPropertyVisit(ctx, scope, id);
  const job = structuredClone(row.job), segment = job.segments.find(item => item.id === segmentId);
  if (!segment || segment.state !== 'pending') throw new Error('El tramo ya se envió. Consulta su estado sin repetir la generación.');
  if (job.segments.some(item => ['submitting', 'generating', 'unknown'].includes(item.state)))
    throw new Error('Resuelve el tramo en curso antes de enviar otro.');
  const usd = propertyVisitSegmentPrice(segment.seconds, job.resolution, job.videoModel);
  const prompt = propertyVisitSegmentPrompt(job, segment);
  if (consent.referencesToKie !== true || !Number.isFinite(consent.maxUsd) || consent.maxUsd < usd)
    throw new Error('Confirma el envío de las imágenes aceptadas a KIE y el coste del tramo.');
  await assertPropertyVisitBudget(job);
  const frames = await propertyVisitAcceptedFrames(ctx, scope, id, job,
    consent.onlyThisSegment === true ? [segment.from, segment.to] : undefined);
  segment.sourceVersions = frames.filter(frame => [segment.from, segment.to].includes(frame.imageId))
    .map(frame => ({ id: frame.id, version: frame.version }));
  if (!(await canUse(ctx.organizationId, 'generate')).allowed) throw new Error('Necesitas saldo para generar el paseo.');
  await assertGlobalCap(await isPremium(ctx.organizationId)); assertCanSpend(ctx.organizationId, usd);
  const provider = new KieVideoProvider(await resolveKieKey());
  segment.state = 'submitting';
  let version = await updatePropertyVisit(ctx, scope, id, row.version, job), reserved = false;
  const holdId = `property-visit:${id}:${segmentId}:${segment.attempts?.length ?? 0}`;
  try {
    await hold({ idempotencyKey: holdId, organizationId: ctx.organizationId, amount: Math.ceil(usd * 100),
      refType: 'property-visit', refId: id, ttlMinutes: 1440 }); reserved = true;
    const first = await provider.uploadReference(await readRenderReference(frames.find(frame => frame.imageId === segment.from)!.payload));
    const last = segment.from === segment.to ? first : await provider.uploadReference(await readRenderReference(frames.find(frame => frame.imageId === segment.to)!.payload));
    segment.taskId = job.videoModel === PROPERTY_VISIT_COMPACT_MODEL
      ? await provider.createCompactTransition(prompt, segment.seconds, first, last)
      : await provider.createTransition(prompt, segment.seconds, job.resolution, first, last);
    segment.state = 'generating';
    version = await updatePropertyVisit(ctx, scope, id, version, job);
    await reconcile(ctx, holdId, id, segment.seconds, usd);
    recordOutcome(ctx.organizationId, true);
  } catch (error) {
    const unknown = error instanceof KieSubmissionUnknownError || Boolean(segment.taskId);
    segment.state = unknown ? 'unknown' : 'failed'; segment.error = error instanceof Error ? error.message : 'No se pudo iniciar el tramo.';
    await updatePropertyVisit(ctx, scope, id, version, job);
    if (reserved) { if (unknown) await settle(holdId); else await revert(holdId); }
    recordOutcome(ctx.organizationId, false);
    throw new Error(segment.error);
  }
}

async function reconcile(ctx: Awaited<ReturnType<typeof requireOrgContext>>, holdId: string, id: string, seconds: number, usd: number) {
  await prisma.usageEvent.upsert({ where: { id: holdId }, create: { id: holdId, orgId: ctx.organizationId, userId: ctx.userId,
    action: 'video.property-visit.estimated', unit: 'second', amount: seconds, cost: usd, refId: id }, update: {} });
  await settle(holdId);
}

export async function checkPropertyVisitSegment(rawScope: EditorScope, id: string, segmentId: string) {
  const scope = normalizeEditorScope(rawScope), ctx = await requireOrgContext(), row = await readPropertyVisit(ctx, scope, id);
  const job = structuredClone(row.job), segment = job.segments.find(item => item.id === segmentId);
  if (!segment) throw new Error('Tramo no encontrado.');
  if (!segment.taskId || !['generating', 'unknown'].includes(segment.state)) return segment.state;
  await reconcile(ctx, `property-visit:${id}:${segmentId}:${segment.attempts?.length ?? 0}`, id, segment.seconds, propertyVisitSegmentPrice(segment.seconds, job.resolution, job.videoModel));
  const provider = new KieVideoProvider(await resolveKieKey()), result = await provider.status(segment.taskId);
  if (result.state === 'pending') return segment.state;
  if (result.state === 'failed') { segment.state = 'failed'; segment.error = 'El proveedor informa de un fallo. No se repite el gasto automáticamente.'; }
  else {
    const key = `videos/${ctx.organizationId}/${scope.projectId}/${id}/${segment.id}-${segment.attempts?.length ?? 0}.mp4`;
    await getStorageAdapter().put({ key, body: await provider.download(result.resultUrl!), contentType: 'video/mp4' });
    segment.state = 'review'; segment.assetKey = key; delete segment.error;
  }
  await updatePropertyVisit(ctx, scope, id, row.version, job);
  return segment.state;
}

/** Revisión humana: ver todo el movimiento y su unión. Tener extremos coincidentes no acredita continuidad temporal. */
export async function reviewPropertyVisitSegment(rawScope: EditorScope, id: string, segmentId: string, accepted: boolean) {
  if (typeof accepted !== 'boolean') throw new Error('Revisión inválida.');
  const scope = normalizeEditorScope(rawScope), ctx = await requireOrgContext(), row = await readPropertyVisit(ctx, scope, id);
  const job = structuredClone(row.job), segment = job.segments.find(item => item.id === segmentId);
  if (!segment || !['review', 'accepted'].includes(segment.state) || !segment.assetKey) throw new Error('Consulta el vídeo terminado antes de revisarlo.');
  if (job.segments.some(item => item.state === 'submitting')) throw new Error('Espera a que se confirme el envío en curso.');
  const frames = await propertyVisitAcceptedFrames(ctx, scope, id, job, [segment.from, segment.to]);
  if (!segment.sourceVersions?.length || segment.sourceVersions.some(source => !frames.some(frame => frame.id === source.id && frame.version === source.version)))
    throw new Error('Las referencias de este tramo cambiaron después de generarlo. Revisa el paseo antes de aceptarlo.');
  segment.state = accepted ? 'accepted' : 'rejected'; segment.reviewedAt = new Date().toISOString(); segment.reviewedBy = ctx.userId;
  delete job.assetKey; delete job.finalReviewedAt; delete job.finalReviewedBy;
  await updatePropertyVisit(ctx, scope, id, row.version, job);
}
