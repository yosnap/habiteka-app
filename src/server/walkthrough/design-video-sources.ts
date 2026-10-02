import 'server-only';
import { prisma } from '@/server/db/prisma';
import type { OrgContext } from '@/server/auth/org-context';
import type { EditorScope } from '@/server/editor/authority';
import { withEditorDocuments } from '@/server/editor/document-repo';
import { resolveRenderUrl } from '@/server/storage/render-urls';
import { renderDesignOptionsSchema } from '@/lib/editor-document/render-design-options';
import { renderImageLabel } from '@/lib/editor-document/render-gallery';
import type { Deliverable } from '@/lib/contracts';
import type { DesignVideoReference } from '@/lib/editor-document/design-video';
import { sameContentRevisions, tourImagesFromRows, tourDocumentReader, sameVisualDesignContent } from './tour-images';
import { assessTourHomogeneity } from '@/lib/editor-document/image-tour';
import { renderViewIntegrityIssue } from '@/lib/editor-document/render-view-integrity';
import { renderReviewIssue } from '@/lib/editor-document/render-review';
import { renderViewSchema } from '@/lib/editor-document/render-view';
import { designVisitContext } from '@/lib/editor-document/design-visit';

export async function designVideoSources(ctx: OrgContext, scope: EditorScope, approvalId?: string, ids?: string[]) {
  const repo = withEditorDocuments(ctx);
  const approved = approvalId ? await repo.readApproval(scope, approvalId) : await repo.latestApproval(scope);
  if (ids && (!ids.length || ids.length > 9 || new Set(ids).size !== ids.length || ids.some(id => typeof id !== 'string' || !id)))
    throw new Error('Elige de 1 a 9 imágenes distintas del diseño.');
  const rows = await prisma.deliverable.findMany({ where: { projectId: scope.projectId, zoneId: scope.zoneId ?? null,
    project: { organizationId: ctx.organizationId, deletedAt: null }, type: 'RENDER_3D', deletedAt: null,
    ...(ids ? { id: { in: ids } } : {}) }, orderBy: { createdAt: 'desc' }, select: { id: true, payload: true, createdAt: true } });
  const candidates = rows.flatMap(row => {
    const payload = row.payload as unknown as Extract<Deliverable['payload'], { type: 'render3d' }>;
    const options = renderDesignOptionsSchema.safeParse(payload?.generation?.options);
    if (payload?.type !== 'render3d' || !payload.generation?.provider || payload.generation.provider === 'native' || !options.success) return [];
    return [{ ...row, payload, options: options.data, revision: payload.generation.documentRevision ?? 0 }];
  });
  const valid = approved ? new Set(await sameContentRevisions(ctx, scope, approved, candidates.map(row => row.revision))) : new Set<number>();
  const compatible = candidates.filter(row => valid.has(row.revision));
  if (ids && compatible.length !== ids.length) throw new Error('Hay imágenes sin ámbito registrado o de otra revisión. Usa los diseños de la aprobación vigente.');
  const ordered = ids ? ids.map(id => compatible.find(row => row.id === id)!) : compatible;
  const issues = new Map(ordered.map(row => [row.id, renderReviewIssue(row.payload.generation)
    ?? (approved ? renderViewIntegrityIssue(approved.document, row.payload.generation?.view) : null)]));
  if (ids) {
    const rejected = ordered.filter(row => issues.get(row.id));
    if (rejected.length) throw new Error(rejected.map(row => `${renderImageLabel({ payload: row.payload } as Deliverable).view}: ${issues.get(row.id)}`).join(' '));
  }
  if (ids && approved) {
    const current = await repo.load(scope);
    if (current.authority !== 'v2' || !sameVisualDesignContent(current.document, approved.document))
      throw new Error('El diseño ha cambiado. Revisa su aprobación antes de preparar la prueba.');
    const images = await tourImagesFromRows(ordered, tourDocumentReader(ctx, scope));
    const assessment = assessTourHomogeneity(images, valid);
    if (!assessment.ok) throw new Error(assessment.issues.map(issue => issue.message).join(' '));
  }
  const references = await Promise.all(ordered.map(async (row): Promise<DesignVideoReference> => {
    const view = row.payload.generation?.view, label = renderImageLabel(row.payload ? { payload: row.payload } as Deliverable : {} as Deliverable);
    const url = await resolveRenderUrl(row.payload);
    if (!url) throw new Error('Una imagen elegida no tiene archivo disponible.');
    const parsedView = renderViewSchema.safeParse(view);
    const visit = approved && parsedView.success ? designVisitContext(approved.document, parsedView.data)
      : { visitIssue: 'La imagen no tiene una cámara interior verificable.' };
    return { id: row.id, name: label.zone, view: label.view, preset: view?.preset, batchId: row.payload.generation?.batchId ?? null,
      revision: row.revision, scope: row.options.designScope,
      zones: row.options.regions.map(region => region.name),
      closedRoof: view?.ceilingView === 'solid' && view.cutaway !== true,
      ...(issues.get(row.id) ? { issue: issues.get(row.id)! } : {}),
      url, ...visit };
  }));
  return { approved, references, rows: ordered };
}
