import type { OrgContext } from '@/server/auth/org-context';
import type { EditorScope } from '@/server/editor/authority';
import { withEditorDocuments } from '@/server/editor/document-repo';
import { prisma } from '@/server/db/prisma';
import { fail } from '@/server/errors/run-action';
import { MAX_TOUR_SHOTS, assessTourHomogeneity } from '@/lib/editor-document/image-tour';
import { sameContentRevisions, sameVisualDesignContent, tourDocumentReader, tourImagesFromRows } from './tour-images';

/** Valida las fuentes reales antes de codificar, firmar la subida y publicar. */
export async function validatedImageTourSources(ctx: OrgContext, scope: EditorScope, approvalId: string, ids: string[]) {
  if (!Array.isArray(ids) || !ids.length || ids.length > MAX_TOUR_SHOTS || new Set(ids).size !== ids.length ||
    ids.some(id => typeof id !== 'string' || !id)) fail(`El montaje admite de 1 a ${MAX_TOUR_SHOTS} imágenes distintas.`);
  const repo = withEditorDocuments(ctx), approved = await repo.readApproval(scope, approvalId);
  const current = await repo.load(scope);
  if (current.authority !== 'v2' || !sameVisualDesignContent(current.document, approved.document))
    fail('El diseño ha cambiado desde su aprobación. Revisa y aprueba los cambios; genera imágenes de esa versión antes de crear el vídeo.');
  const rows = await prisma.deliverable.findMany({ where: { id: { in: ids }, projectId: scope.projectId,
    project: { organizationId: ctx.organizationId }, type: 'RENDER_3D', deletedAt: null, zoneId: scope.zoneId ?? null },
    select: { id: true, payload: true, createdAt: true } });
  if (rows.length !== ids.length) fail('Alguna imagen no pertenece a este proyecto o a este ámbito.');
  const shots = await tourImagesFromRows(rows, tourDocumentReader(ctx, scope));
  if (shots.length !== ids.length) fail('Alguna imagen elegida no tiene archivo disponible.');
  const revisions = await sameContentRevisions(ctx, scope, approved, shots.map(shot => shot.revision));
  const result = assessTourHomogeneity(shots, new Set(revisions));
  if (!result.ok) fail(result.issues.map(issue => issue.message).join(' '));
  return approved;
}
