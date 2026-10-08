import 'server-only';
import { prisma } from '@/server/db/prisma';
import type { OrgContext } from '@/server/auth/org-context';
import type { EditorScope } from '@/server/editor/authority';
import type { PropertyVisitJob } from '@/lib/editor-document/property-visit-job';
import type { DeliverablePayload } from '@/lib/contracts/deliverable';
import { acceptedRenderIssue } from '@/lib/editor-document/render-review';
import { withEditorDocuments } from '@/server/editor/document-repo';
import { propertyVisitDocument } from '@/lib/editor-document/property-visit-document';
import { sameCameraPose } from '@/lib/contracts/storyboard-image';
import { cameraPoseFromView } from '@/lib/contracts/walkthrough-keyframe';
import { renderViewSchema } from '@/lib/editor-document/render-view';
import { designVideoSources } from './design-video-sources';

export async function propertyVisitSourceDocument(ctx: OrgContext, scope: EditorScope, job: PropertyVisitJob) {
  const approved = await withEditorDocuments(ctx).readApproval(scope, job.approvalId);
  if (!approved || approved.fingerprint !== job.approvedFingerprint) throw new Error('La aprobación del paseo ha cambiado.');
  return propertyVisitDocument(approved.document, job.openDoors).document;
}

export async function propertyVisitAnchors(ctx: OrgContext, scope: EditorScope, job: PropertyVisitJob) {
  const sources = await designVideoSources(ctx, scope, job.approvalId);
  return job.anchorIds.map(id => {
    const reference = sources.references.find(item => item.id === id), row = sources.rows.find(item => item.id === id);
    if (!reference || !row || reference.issue || reference.lighting !== job.lighting)
      throw new Error('Una referencia del diseño ya no está aceptada o no coincide con la luz del paseo.');
    return row;
  });
}

export async function propertyVisitAcceptedFrames(ctx: OrgContext, scope: EditorScope, id: string, job: PropertyVisitJob,
  imageIds?: string[]) {
  if (imageIds && (!imageIds.length || imageIds.some(imageId => !job.images.some(image => image.id === imageId))))
    throw new Error('Los encuadres elegidos no pertenecen al paseo.');
  const images = imageIds ? job.images.filter(image => imageIds.includes(image.id)) : job.images;
  await propertyVisitSourceDocument(ctx, scope, job);
  await propertyVisitAnchors(ctx, scope, job);
  const rows = await prisma.deliverable.findMany({ where: { id: { in: images.flatMap(image => image.sourceId ? [image.sourceId] : []) },
    projectId: scope.projectId, zoneId: scope.zoneId ?? null, type: 'RENDER_3D', deletedAt: null,
    project: { organizationId: ctx.organizationId, deletedAt: null } }, select: { id: true, payload: true, version: true } });
  return images.map(image => {
    const row = rows.find(item => item.id === image.sourceId);
    if (!row) throw new Error(`Falta generar y aceptar ${image.frame.label}.`);
    const payload = row.payload as unknown as Extract<DeliverablePayload, { type: 'render3d' }>, generation = payload.generation;
    const issue = acceptedRenderIssue(generation), view = renderViewSchema.safeParse(generation?.view), binding = generation?.propertyVisit;
    if (issue) throw new Error(`${image.frame.label}: ${issue}`);
    if (!view.success || !binding || binding.id !== id || binding.imageId !== image.id || binding.openDoors !== job.openDoors ||
      JSON.stringify(binding.anchorIds) !== JSON.stringify(job.anchorIds) || view.data.lighting !== job.lighting ||
      generation?.documentRevision !== job.approvedRevision || view.data.preset !== 'custom' || view.data.allLevels || view.data.cutaway ||
      view.data.ceilingView !== 'solid' || view.data.cutawayWallIds?.length || view.data.cutawayObjectIds?.length || Math.abs(view.data.aspect - 16 / 9) > .02 ||
      !sameCameraPose(cameraPoseFromView(view.data), image.frame.camera))
      throw new Error('Una imagen no corresponde al encuadre y estado del paseo guardado.');
    return { ...row, payload, imageId: image.id };
  });
}
