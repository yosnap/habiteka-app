'use server';
import { z } from 'zod';
import { requireOrgContext } from '@/server/auth/require-org-context';
import { assertEditorScope, normalizeEditorScope, type EditorScope } from '@/server/editor/authority';
import { prisma } from '@/server/db/prisma';
import { withEditorDocuments } from '@/server/editor/document-repo';
import { designVideoSources } from './design-video-sources';
import { propertyVisitDocument } from '@/lib/editor-document/property-visit-document';
import { planPropertyVisit } from '@/lib/editor-document/property-visit-plan';
import { propertyVisitSequence, propertyVisitSegmentPrompt, PROPERTY_VISIT_COMPACT_MODEL, type PropertyVisitJob } from '@/lib/editor-document/property-visit-job';
import { readPropertyVisit, visitJson } from './property-visit-repo';
import { DELIVERABLE_LEGAL_SEAL } from '@/lib/legal-text';
import { resolveRoutes } from '@/server/ai/model-routing';
import { allowedModel } from '@/server/admin/config/model-allowlist';
import { LIGHTING_PRESETS } from '@/lib/lighting-preset';
import { resolveRenderUrl } from '@/server/storage/render-urls';
import { acceptedRenderIssue, renderReviewIssue } from '@/lib/editor-document/render-review';
import type { DeliverablePayload } from '@/lib/contracts/deliverable';
import { getStorageAdapter } from '@/server/storage/s3-storage-adapter';
import { inspectPropertyVisitBudget } from './property-visit-budget';

const preparation = z.object({ approvalId: z.string().min(1), entryId: z.string().min(1),
  openDoors: z.boolean(), lighting: z.enum(LIGHTING_PRESETS), anchorIds: z.array(z.string().min(1)).min(2).max(2),
  resolution: z.literal('768P').default('768P') }).strict();

export async function savePropertyVisit(rawScope: EditorScope, rawInput: z.input<typeof preparation>) {
  const scope = normalizeEditorScope(rawScope), input = preparation.parse(rawInput), ctx = await requireOrgContext();
  const sources = await designVideoSources(ctx, scope, input.approvalId);
  if (!sources.approved) throw new Error('Falta la aprobación del proyecto.');
  const anchors = input.anchorIds.map(id => sources.references.find(reference => reference.id === id));
  if (anchors.some(anchor => !anchor || anchor.issue || anchor.lighting !== input.lighting) ||
    anchors[0]?.preset !== 'top' || !anchors[1]?.closedRoof || anchors[1]?.preset === 'custom' || anchors[1]?.preset === 'top')
    throw new Error('Elige una cenital aceptada y un exterior con tejado aceptado, de esta versión y luz.');
  const scene = propertyVisitDocument(sources.approved.document, input.openDoors);
  const plan = planPropertyVisit(scene.document, input.entryId), sequence = propertyVisitSequence(plan);
  const route = (await resolveRoutes('render3d'))[0];
  const price = route && allowedModel('render3d', route.model, route.provider)?.priceUsdPerUnit;
  if (!route || price === undefined || !Number.isFinite(price) || price < 0) throw new Error('Falta un precio conocido para las imágenes.');
  const job: PropertyVisitJob = { type: 'video', mode: 'property-visit-ai', title: 'Paseo completo del inmueble',
    approvalId: sources.approved.id, approvedRevision: sources.approved.revision, approvedFingerprint: sources.approved.fingerprint,
    lighting: input.lighting, openDoors: input.openDoors, anchorIds: input.anchorIds, resolution: input.resolution,
    plan, ...sequence, durationMs: plan.durationSeconds * 1000, imagePriceUsd: price,
    imageModel: `${route.provider}:${route.model}`, videoModel: PROPERTY_VISIT_COMPACT_MODEL, createdAt: new Date().toISOString() };
  // Comprobar el contrato completo antes de guardar o generar ninguna imagen.
  job.segments.forEach(segment => propertyVisitSegmentPrompt(job, segment));
  const id = crypto.randomUUID();
  await prisma.$transaction(async tx => {
    await assertEditorScope(tx, ctx, scope, { lock: true });
    await tx.deliverable.create({ data: { id, projectId: scope.projectId, zoneId: scope.zoneId ?? null,
      type: 'VIDEO', payload: visitJson(job), legalSeal: DELIVERABLE_LEGAL_SEAL } });
  });
  return { id, job };
}

export async function listPropertyVisits(rawScope: EditorScope) {
  const scope = normalizeEditorScope(rawScope), ctx = await requireOrgContext();
  await prisma.$transaction(tx => assertEditorScope(tx, ctx, scope));
  const rows = await prisma.deliverable.findMany({ where: { projectId: scope.projectId, zoneId: scope.zoneId ?? null,
    project: { organizationId: ctx.organizationId, deletedAt: null }, type: 'VIDEO', deletedAt: null },
    orderBy: { createdAt: 'desc' }, select: { id: true, payload: true } });
  return rows.filter(row => (row.payload as { mode?: string }).mode === 'property-visit-ai')
    .map(row => ({ id: row.id, job: row.payload as unknown as PropertyVisitJob }));
}

export async function loadPropertyVisit(rawScope: EditorScope, id: string) {
  const scope = normalizeEditorScope(rawScope), ctx = await requireOrgContext(), row = await readPropertyVisit(ctx, scope, id);
  const approved = await withEditorDocuments(ctx).readApproval(scope, row.job.approvalId);
  if (approved.fingerprint !== row.job.approvedFingerprint) throw new Error('La aprobación ya no coincide con el paseo.');
  const ids = row.job.images.flatMap(image => image.sourceId ? [image.sourceId] : []);
  const rows = await prisma.deliverable.findMany({ where: { id: { in: [...ids, ...row.job.anchorIds] }, projectId: scope.projectId,
    zoneId: scope.zoneId ?? null, type: 'RENDER_3D', deletedAt: null, project: { organizationId: ctx.organizationId } },
    select: { id: true, payload: true, version: true } });
  const media = await Promise.all(rows.map(async image => {
    const payload = image.payload as unknown as Extract<DeliverablePayload, { type: 'render3d' }>;
    return { id: image.id, version: image.version, url: await resolveRenderUrl(payload), issue: acceptedRenderIssue(payload.generation),
      reviewIssue: renderReviewIssue(payload.generation),
      canRereview: Boolean(payload.generation?.propertyVisit && !payload.generation.acceptance
        && payload.generation.review?.source !== 'visual-inspection' && renderReviewIssue(payload.generation)) };
  }));
  const images = media.filter(image => ids.includes(image.id));
  const anchors = row.job.anchorIds.flatMap(id => { const image = media.find(item => item.id === id); return image ? [image] : []; });
  const storage = getStorageAdapter();
  const segments = await Promise.all(row.job.segments.map(async segment => ({ id: segment.id,
    url: segment.assetKey ? await storage.getPresignedDownloadUrl(segment.assetKey) : null })));
  return { id, job: row.job, images, anchors, segments, budget: await inspectPropertyVisitBudget(row.job), document: propertyVisitDocument(approved.document, row.job.openDoors).document,
    url: row.job.assetKey ? await storage.getPresignedDownloadUrl(row.job.assetKey) : null };
}
