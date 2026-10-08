import 'server-only';
import { prisma } from '@/server/db/prisma';
import type { Prisma } from '@/generated/prisma/client';
import type { OrgContext } from '@/server/auth/org-context';
import { assertEditorScope, type EditorScope } from '@/server/editor/authority';
import type { PropertyVisitJob } from '@/lib/editor-document/property-visit-job';
export const visitJson = (job: PropertyVisitJob) => JSON.parse(JSON.stringify(job)) as Prisma.InputJsonValue;
export async function readPropertyVisit(ctx: OrgContext, scope: EditorScope, id: string) {
  const row = await prisma.deliverable.findFirst({ where: { id, projectId: scope.projectId, zoneId: scope.zoneId ?? null,
    type: 'VIDEO', deletedAt: null, project: { organizationId: ctx.organizationId, deletedAt: null } } });
  if (!row || (row.payload as { mode?: string }).mode !== 'property-visit-ai') throw new Error('Paseo no encontrado en este proyecto.');
  return { ...row, job: row.payload as unknown as PropertyVisitJob };
}
export async function updatePropertyVisit(ctx: OrgContext, scope: EditorScope, id: string, version: number, job: PropertyVisitJob) {
  return prisma.$transaction(async tx => {
    await assertEditorScope(tx, ctx, scope, { lock: true });
    const result = await tx.deliverable.updateMany({ where: { id, version, projectId: scope.projectId, zoneId: scope.zoneId ?? null, deletedAt: null },
      data: { payload: visitJson(job), version: { increment: 1 } } });
    if (result.count !== 1) throw new Error('El paseo cambió en otra pestaña. Actualiza su estado antes de continuar.');
    return version + 1;
  });
}
