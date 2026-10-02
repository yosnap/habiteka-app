import 'server-only';
import { prisma } from '@/server/db/prisma';
import type { Prisma } from '@/generated/prisma/client';
import type { OrgContext } from '@/server/auth/org-context';
import { assertEditorScope, type EditorScope } from '@/server/editor/authority';
import type { DesignVideoJob } from '@/lib/editor-document/design-video';

export const jobJson = (job: DesignVideoJob) => JSON.parse(JSON.stringify(job)) as Prisma.InputJsonValue;
export async function readDesignVideoJob(ctx: OrgContext, scope: EditorScope, id: string) {
  const row = await prisma.deliverable.findFirst({ where: { id, projectId: scope.projectId, zoneId: scope.zoneId ?? null,
    type: 'VIDEO', deletedAt: null, project: { organizationId: ctx.organizationId, deletedAt: null } } });
  if (!row || (row.payload as { mode?: string }).mode !== 'construction-ai') throw new Error('Prueba de vídeo no encontrada en este proyecto.');
  return { ...row, job: row.payload as unknown as DesignVideoJob };
}
/** Una sola petición puede reclamar la preparación, incluso con dos pestañas abiertas. */
export async function updateDesignVideoJob(ctx: OrgContext, scope: EditorScope, id: string, version: number, job: DesignVideoJob) {
  return prisma.$transaction(async tx => {
    await assertEditorScope(tx, ctx, scope, { lock: true });
    const changed = await tx.deliverable.updateMany({ where: { id, version, projectId: scope.projectId, zoneId: scope.zoneId ?? null, deletedAt: null },
      data: { payload: jobJson(job), version: { increment: 1 } } });
    if (changed.count !== 1) throw new Error('La prueba cambió en otra pestaña. Actualiza su estado antes de continuar.');
    return version + 1;
  });
}
