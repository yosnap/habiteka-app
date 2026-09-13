import type { Prisma } from '@/generated/prisma/client';
import type { OrgContext } from '@/server/auth/org-context';
import { prisma } from '@/server/db/prisma';
import { resolveRenderUrl } from '@/server/storage/render-urls';
import type { StudioState } from '@/lib/studio-state';

export async function loadStudio(ctx: OrgContext, projectId: string): Promise<StudioState> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: ctx.organizationId, deletedAt: null },
    select: { studioState: true },
  });
  if (!project) throw new Error('Proyecto no encontrado en tu organización');
  const state = (project.studioState ?? {}) as StudioState;
  for (const key of ['source', 'plan', 'cenital'] as const) {
    const ref = state[key];
    if (ref) state[key] = { ...ref, assetUrl: (await resolveRenderUrl(ref)) ?? ref.assetUrl };
  }
  return state;
}

export async function saveStudio(ctx: OrgContext, projectId: string, state: StudioState) {
  const result = await prisma.project.updateMany({
    where: { id: projectId, organizationId: ctx.organizationId, deletedAt: null },
    data: { studioState: state as Prisma.InputJsonValue },
  });
  if (!result.count) throw new Error('Proyecto no encontrado en tu organización');
}
