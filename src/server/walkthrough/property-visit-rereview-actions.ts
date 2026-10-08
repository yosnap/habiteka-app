'use server';
import { requireOrgContext } from '@/server/auth/require-org-context';
import { normalizeEditorScope, type EditorScope } from '@/server/editor/authority';
import { prisma } from '@/server/db/prisma';
import { readPropertyVisit } from './property-visit-repo';
import { propertyVisitAnchors, propertyVisitSourceDocument } from './property-visit-sources';
import { renderViewSchema, type RenderCapture } from '@/lib/editor-document/render-view';
import { sameCameraPose } from '@/lib/contracts/storyboard-image';
import { cameraPoseFromView } from '@/lib/contracts/walkthrough-keyframe';
import { assertRenderViewIntegrity } from '@/lib/editor-document/render-view-integrity';
import { propertyVisitRoomContext } from '@/lib/editor-document/property-visit-room-context';
import { defaultRenderDesignOptions } from '@/lib/editor-document/render-design-options';
import { sanitizeImageBuffer, sanitizeOwnRenderBuffer } from '@/server/ai/image/input-sanitizer';
import { readRenderBytes, readRenderReference } from '@/server/agent/editor-v2/render-asset-reader';
import { renderSpatialReference } from '@/server/agent/editor-v2/render-spatial-reference';
import { openingSightlineDepths } from '@/server/agent/editor-v2/accepted-interior-prompt';
import { fitRenderReferenceAspect } from '@/server/agent/editor-v2/render-reference-frame';
import { getChatVisionAdapter } from '@/server/ai';
import { reviewRenderFidelity, unfinishedRenderReview } from '@/server/agent/editor-v2/review-render-fidelity';
import { projectVehicleCount } from '@/server/agent/editor-v2/selected-view-image-prompt';
import { assertConsent } from '@/server/privacy/consent-service';
import { assertTosAccepted } from '@/server/legal/tos-acceptance-service';
import { renderReviewIssue } from '@/lib/editor-document/render-review';
import type { DeliverablePayload } from '@/lib/contracts/deliverable';
import { propertyVisitImageLocked } from '@/lib/editor-document/property-visit-job';

const reviewing = new Set<string>();
/** Reutiliza el candidato y reconstruye la guía; solo consume visión, nunca imagen ni vídeo. */
export async function rereviewPropertyVisitImage(rawScope: EditorScope, id: string, imageId: string,
  capture: RenderCapture, analysisConsent: boolean) {
  if (!analysisConsent) throw new Error('Confirma el coste de los análisis de esta revisión.');
  const scope = normalizeEditorScope(rawScope), ctx = await requireOrgContext();
  const { job, version: jobVersion } = await readPropertyVisit(ctx, scope, id);
  const image = job.images.find(item => item.id === imageId);
  if (!image?.sourceId || !['review', 'rejected'].includes(image.state) || propertyVisitImageLocked(job, imageId))
    throw new Error('Solo se revisan imágenes terminadas que todavía no se han usado en un tramo.');
  const row = await prisma.deliverable.findFirst({ where: { id: image.sourceId, projectId: scope.projectId,
    zoneId: scope.zoneId ?? null, deletedAt: null, type: 'RENDER_3D', project: { organizationId: ctx.organizationId } },
    select: { payload: true, version: true } });
  const payload = row?.payload as unknown as Extract<DeliverablePayload, { type: 'render3d' }> | undefined;
  const generation = payload?.generation, binding = generation?.propertyVisit;
  if (!row || !payload || !generation || generation.acceptance || generation.review?.source === 'visual-inspection'
    || !renderReviewIssue(generation) || binding?.id !== id || binding.imageId !== imageId
    || binding.openDoors !== job.openDoors || JSON.stringify(binding.anchorIds) !== JSON.stringify(job.anchorIds)
    || generation.documentRevision !== job.approvedRevision)
    throw new Error('Este encuadre no admite repetir su auditoría automática.');
  const document = await propertyVisitSourceDocument(ctx, scope, job), anchors = await propertyVisitAnchors(ctx, scope, job);
  const view = renderViewSchema.parse(capture.view), original = renderViewSchema.parse(generation.view);
  if (![view, original].every(value => sameCameraPose(cameraPoseFromView(value), image.frame.camera)
    && value.preset === 'custom' && !value.allLevels && !value.cutaway && value.ceilingView === 'solid'
    && !value.cutawayWallIds?.length && !value.cutawayObjectIds?.length
    && Math.abs(value.aspect - 16 / 9) <= .02 && value.lighting === job.lighting))
    throw new Error('La guía no coincide con la cámara, cubierta o iluminación guardadas.');
  assertRenderViewIntegrity(document, view);
  const match = typeof capture.dataUrl === 'string' && capture.dataUrl.length <= 14_000_000
    ? /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(capture.dataUrl) : null;
  if (!match) throw new Error('Falta una captura PNG válida de la guía.');
  await assertConsent(ctx.userId, 'IMAGE_PROCESSING'); await assertTosAccepted(ctx.userId);
  if (reviewing.has(image.sourceId)) throw new Error('La revisión de este encuadre sigue en curso.');
  reviewing.add(image.sourceId);
  try {
    const context = propertyVisitRoomContext(document, image.frame);
    delete view.roomId; delete view.roomName; delete view.roomAreaM2; delete view.zones;
    if (context) Object.assign(view, context);
    const spatial = await renderSpatialReference(document, view, { ...defaultRenderDesignOptions(), lighting: job.lighting });
    const reference = (await fitRenderReferenceAspect(await sanitizeImageBuffer(Buffer.from(match[1]!, 'base64')))).image;
    const candidate = await sanitizeOwnRenderBuffer((await readRenderBytes(payload)).raw);
    const identity = await readRenderReference(anchors[0]!.payload);
    const architecture = await readRenderReference(anchors[1]!.payload);
    const vision = await getChatVisionAdapter({ organizationId: ctx.organizationId, userId: ctx.userId,
      projectId: scope.projectId, refId: image.sourceId, batchId: id }, 'vision');
    const result: { fidelity?: typeof generation.fidelity; review?: typeof generation.review } = await reviewRenderFidelity(vision, reference, candidate, view, undefined, projectVehicleCount(document),
      false, { identity, architecture, interior: Boolean(context) }, false, false, spatial,
      { reference: 'capture', people: false, acceptedBrief: generation.acceptedBrief, openingDepths: openingSightlineDepths(document, view, spatial.context) })
      .catch(unfinishedRenderReview);
    // Conservar el informe anterior y detectar aceptación/cambio de encuadre mientras se analizaba.
    const history = (generation as typeof generation & { reviewHistory?: unknown[] }).reviewHistory ?? [];
    const next = { ...generation, ...result, view, reviewHistory: [...history,
      { fidelity: generation.fidelity, review: generation.review, replacedAt: new Date().toISOString() }] };
    if (!result.review) delete next.review;
    if (!result.fidelity) delete next.fidelity;
    await prisma.$transaction(async tx => {
      const unchanged = await tx.deliverable.updateMany({ where: { id, version: jobVersion, deletedAt: null },
        data: { version: { increment: 1 } } });
      if (unchanged.count !== 1) throw new Error('El paseo cambió durante la revisión. Actualiza su estado.');
      const updated = await tx.deliverable.updateMany({ where: { id: image.sourceId, version: row.version, deletedAt: null },
        data: { payload: JSON.parse(JSON.stringify({ ...payload, generation: next })), version: { increment: 1 } } });
      if (updated.count !== 1) throw new Error('La imagen cambió durante la revisión. Actualiza su estado.');
    });
    return { passed: !result.review, reason: result.review?.reason ?? null };
  } finally { reviewing.delete(image.sourceId); }
}
