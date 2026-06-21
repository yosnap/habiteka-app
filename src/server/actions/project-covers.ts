'use server';

/**
 * Portadas de proyecto: por cada proyecto de la organización, la URL del primer
 * render generado (si lo hay), para mostrarla como miniatura en «Mis proyectos».
 * Si un proyecto no tiene render, su entrada es null y la tarjeta muestra el aviso
 * de "aún sin diseños".
 */
import { requireOrgContext } from '@/server/auth/require-org-context';
import { prisma } from '@/server/db/prisma';

export type ProjectCovers = Record<string, string | null>;

export async function getProjectCovers(projectIds: string[]): Promise<ProjectCovers> {
  if (projectIds.length === 0) return {};
  const ctx = await requireOrgContext();

  // Solo renders vivos de proyectos de la organización (aislamiento por org).
  const rows = await prisma.deliverable.findMany({
    where: {
      projectId: { in: projectIds },
      type: 'RENDER_3D',
      deletedAt: null,
      project: { organizationId: ctx.organizationId, deletedAt: null },
    },
    select: { projectId: true, payload: true },
    orderBy: { createdAt: 'desc' },
  });

  const covers: ProjectCovers = {};
  for (const id of projectIds) covers[id] = null;
  for (const row of rows) {
    if (covers[row.projectId]) continue; // ya tiene portada (la más reciente)
    const url = (row.payload as { assetUrl?: string } | null)?.assetUrl;
    if (url) covers[row.projectId] = url;
  }
  return covers;
}
