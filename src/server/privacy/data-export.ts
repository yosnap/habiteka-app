/**
 * Portabilidad de datos (RGPD art. 20): exporta el contenido de una organización
 * en un formato estructurado y legible por máquina (JSON).
 *
 * Incluye proyectos vivos con su contenido (conversaciones, mensajes, canvas,
 * entregables) y el histórico de consentimiento. No incluye datos de otras
 * organizaciones (aislamiento por `organizationId`) ni secretos.
 */
import { prisma } from '@/server/db/prisma';

export interface DataExport {
  exportedAt: string;
  organizationId: string;
  projects: unknown[];
  consents: unknown[];
}

/** Construye el export de datos de una organización (art. 20). */
export async function exportOrganizationData(
  organizationId: string,
  exportedAt: Date,
): Promise<DataExport> {
  const projects = await prisma.project.findMany({
    where: { organizationId, deletedAt: null },
    select: {
      id: true,
      title: true,
      createdAt: true,
      conversations: {
        select: {
          id: true,
          createdAt: true,
          messages: {
            select: { id: true, role: true, content: true, createdAt: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      },
      // Multi-zona: un proyecto puede tener varios planos (uno por zona + el
      // plano por defecto con zoneId null) y varias zonas. Se exportan todos.
      canvasStates: { select: { zoneId: true, data: true, updatedAt: true } },
      zones: {
        where: { deletedAt: null },
        select: { id: true, name: true, kind: true, order: true, createdAt: true },
      },
      deliverables: {
        where: { deletedAt: null },
        select: {
          id: true,
          type: true,
          payload: true,
          version: true,
          createdAt: true,
          zoneId: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const consents = await prisma.consentRecord.findMany({
    where: { organizationId },
    select: { purpose: true, policyVersion: true, granted: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  return {
    exportedAt: exportedAt.toISOString(),
    organizationId,
    projects,
    consents,
  };
}
