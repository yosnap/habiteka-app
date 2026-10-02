'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireOrgContext } from '@/server/auth/require-org-context';
import { assertEditorScope, type EditorScope } from '@/server/editor/authority';
import { prisma } from '@/server/db/prisma';
import { fail, runAction } from '@/server/errors/run-action';
import { videoTitleSchema } from '@/lib/editor-document/video-title';
import { renderImageLabel } from '@/lib/editor-document/render-gallery';
import type { Deliverable } from '@/lib/contracts';
import { resolveRenderUrl } from '@/server/storage/render-urls';
import { isDesignVideoMode } from '@/lib/editor-document/design-video';

const idsSchema = z.array(z.string().min(1).max(128)).min(1).max(200)
  .refine(ids => new Set(ids).size === ids.length, 'La selección contiene imágenes repetidas.');

/** Se conserva el archivo y la procedencia: limpiar no borra objetos ni vídeos derivados. */
export async function removeStudioImages(scope: EditorScope, ids: string[]) {
  return runAction(() => changeImageDeletion(scope, ids, true));
}
export async function restoreStudioImages(scope: EditorScope, ids: string[]) {
  return runAction(() => changeImageDeletion(scope, ids, false));
}
export async function listStudioDeletedImages(scope: EditorScope) {
  return runAction(async () => {
    const ctx = await requireOrgContext();
    const target = await prisma.$transaction(tx => assertEditorScope(tx, ctx, scope));
    const rows = await prisma.deliverable.findMany({ where: { ...target, type: 'RENDER_3D', deletedAt: { not: null },
      project: { organizationId: ctx.organizationId, deletedAt: null } }, orderBy: { deletedAt: 'desc' }, take: 200,
      select: { id: true, payload: true } });
    return Promise.all(rows.map(async row => {
      const label = renderImageLabel({ payload: row.payload } as unknown as Deliverable);
      return { id: row.id, label: `${label.zone} · ${label.view}`, url: await resolveRenderUrl(row.payload as { assetKey?: string; assetUrl?: string }) };
    }));
  });
}
async function changeImageDeletion(scope: EditorScope, input: string[], remove: boolean) {
  const ctx = await requireOrgContext(), ids = idsSchema.parse(input);
  await prisma.$transaction(async tx => {
    const target = await assertEditorScope(tx, ctx, scope, { lock: true });
    const where = { ...target, id: { in: ids }, type: 'RENDER_3D' as const,
      deletedAt: remove ? null : { not: null }, project: { organizationId: ctx.organizationId, deletedAt: null } };
    if (await tx.deliverable.count({ where }) !== ids.length) fail('Alguna imagen cambió o no pertenece a este proyecto y zona. Actualiza la lista.');
    const changed = await tx.deliverable.updateMany({ where, data: { deletedAt: remove ? new Date() : null, version: { increment: 1 } } });
    if (changed.count !== ids.length) fail('La selección cambió. Actualiza la lista antes de continuar.');
  });
  refreshMedia(scope.projectId);
  return { ids };
}

export async function renameStudioVideo(scope: EditorScope, id: string, input: string) {
  return runAction(async () => {
    const ctx = await requireOrgContext(), title = videoTitleSchema.parse(input) ?? '';
    z.string().min(1).max(128).parse(id);
    await prisma.$transaction(async tx => {
      const target = await assertEditorScope(tx, ctx, scope, { lock: true });
      const row = await tx.deliverable.findFirst({ where: { ...target, id, type: 'VIDEO', deletedAt: null,
        project: { organizationId: ctx.organizationId, deletedAt: null } }, select: { payload: true, version: true } });
      if (!row || !row.payload || typeof row.payload !== 'object' || Array.isArray(row.payload)) fail('Vídeo no encontrado en este proyecto y zona.');
      if (isDesignVideoMode(row.payload.mode) && ['submitting', 'generating', 'unknown'].includes(String(row.payload.status)))
        fail('Espera a que termine o se resuelva el envío H3 antes de cambiar su nombre.');
      const changed = await tx.deliverable.updateMany({ where: { ...target, id, type: 'VIDEO', deletedAt: null, version: row.version },
        data: { payload: { ...row.payload, title }, version: { increment: 1 } } });
      if (changed.count !== 1) fail('El vídeo cambió en otra pestaña. Actualiza antes de cambiar el nombre.');
    });
    refreshMedia(scope.projectId);
    return { title };
  });
}
function refreshMedia(projectId: string) {
  for (const page of ['videos', 'deliverables', 'historial']) revalidatePath(`/projects/${projectId}/${page}`);
}
