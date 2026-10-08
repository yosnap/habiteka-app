'use server';
import { revalidatePath } from 'next/cache';
import { requireOrgContext } from '@/server/auth/require-org-context';
import { assertEditorScope, type EditorScope } from '@/server/editor/authority';
import { prisma } from '@/server/db/prisma';
import type { DeliverablePayload } from '@/lib/contracts/deliverable';
import { renderReviewIssue } from '@/lib/editor-document/render-review';

/** Decisión explícita sobre una imagen existente; no genera ni aprueba el plano. */
export async function setRenderAcceptance(scope: EditorScope, id: string, version: number, accept: boolean) {
  const ctx = await requireOrgContext();
  if (!id || !Number.isSafeInteger(version) || version < 1 || typeof accept !== 'boolean') throw new Error('Imagen o versión no válida.');
  const result = await prisma.$transaction(async tx => {
    await assertEditorScope(tx, ctx, scope, { lock: true });
    const row = await tx.deliverable.findFirst({ where: { id, projectId: scope.projectId, zoneId: scope.zoneId ?? null,
      type: 'RENDER_3D', deletedAt: null, project: { organizationId: ctx.organizationId, deletedAt: null } } });
    if (!row || row.version !== version) throw new Error('La imagen ha cambiado o no pertenece a este ámbito. Recarga Diseños.');
    const payload = row.payload as unknown as Extract<DeliverablePayload, { type: 'render3d' }>;
    const generation = payload.generation;
    if (payload.type !== 'render3d' || !generation?.provider || generation.provider === 'native') throw new Error('Solo puedes aceptar diseños generados con IA.');
    const issue = renderReviewIssue(generation);
    if (accept && issue) throw new Error(issue);
    const metadata = { ...generation };
    delete metadata.acceptance;
    const acceptance = accept ? { acceptedAt: new Date().toISOString(), userId: ctx.userId } : undefined;
    const updated = await tx.deliverable.updateMany({ where: { id, version, deletedAt: null }, data: {
      payload: JSON.parse(JSON.stringify({ ...payload, generation: { ...metadata, ...(acceptance ? { acceptance } : {}) } })), version: { increment: 1 } } });
    if (updated.count !== 1) throw new Error('La imagen ha cambiado. Recarga Diseños.');
    return { accepted: accept, version: version + 1, acceptedAt: acceptance?.acceptedAt ?? null };
  });
  revalidatePath(`/projects/${scope.projectId}/deliverables`);
  revalidatePath(`/projects/${scope.projectId}/videos`);
  return result;
}
