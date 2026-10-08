import type { Prisma } from '@/generated/prisma/client';
import type { OrgContext } from '@/server/auth/org-context';
import { prisma } from '@/server/db/prisma';
import { resolveRenderUrl } from '@/server/storage/render-urls';
import type { StudioResultView, StudioState } from '@/lib/studio-state';
import { studioResults } from '@/lib/studio-results';

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
  const importImage = state.planImport?.image;
  if (importImage) {
    state.planImport!.image = { ...importImage, assetUrl: (await resolveRenderUrl(importImage)) ?? importImage.assetUrl };
  }
  const background = state.editorReference?.image;
  if (background) {
    state.editorReference = { ...state.editorReference!, image: { ...background, assetUrl: (await resolveRenderUrl(background)) ?? background.assetUrl } };
  }
  for (const mode of ['tecnico', 'decorado'] as const) {
    const ref = state.redraws?.[mode];
    if (ref) state.redraws![mode] = { ...ref, assetUrl: (await resolveRenderUrl(ref)) ?? ref.assetUrl };
  }
  return state;
}

export async function saveStudio(ctx: OrgContext, projectId: string, state: StudioState, options: { expectedImportRevision?: string } = {}) {
  const result = await prisma.project.updateMany({
    where: { id: projectId, organizationId: ctx.organizationId, deletedAt: null,
      ...(options.expectedImportRevision ? { studioState: { path: ['planImportRevision'], equals: options.expectedImportRevision } } : {}),
    },
    data: { studioState: state as Prisma.InputJsonValue },
  });
  if (!result.count) throw new Error(options.expectedImportRevision
    ? 'La revisión cambió en otra pestaña. Recarga antes de guardar tus cambios.' : 'Proyecto no encontrado en tu organización');
}

/** Hidrata la galería con URLs nuevas sin persistirlas en el historial. */
export async function resolveStudioResultViews(state: StudioState): Promise<StudioResultView[]> {
  return Promise.all(studioResults(state).map(async (result) => ({
    ...result,
    url: await resolveRenderUrl({ assetKey: result.assetKey }),
  })));
}
