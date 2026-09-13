/**
 * Persistencia de los entregables generados por la fase de entrega.
 *
 * `runDelivery` produce los entregables sellados pero no los escribe: este repo es
 * quien los guarda en la base de datos (mapeando el tipo del contrato al enum de
 * Prisma) para que la vista de «Diseños» pueda mostrarlos.
 */
import type { Prisma } from '@/generated/prisma/client';
import type { DeliverableType as PrismaDeliverableType } from '@/generated/prisma/enums';
import { prisma } from '@/server/db/prisma';
import type { Deliverable } from '@/lib/contracts';

// El contrato usa minúsculas ('render3d'); el enum de Prisma, mayúsculas.
const TYPE_TO_ENUM: Record<string, PrismaDeliverableType> = {
  plano2d: 'PLANO_2D',
  render3d: 'RENDER_3D',
  memoria: 'MEMORIA',
};

/**
 * Guarda los entregables de un proyecto. Idempotente por id (upsert).
 *
 * `sourceImageId` (opcional) vincula cada entregable con la imagen de origen que lo
 * produjo (trazabilidad origen→diseño). Solo se setea al crear: un re-upsert por
 * reintento no lo pisa, y entregables sin imagen de origen (flujo del lienzo) lo
 * dejan en null. La pertenencia de la imagen ya la validó la capa con scope de org.
 */
export async function persistDeliverables(
  projectId: string,
  deliverables: Deliverable[],
  sourceImageId?: string,
  zoneId: string | null = null,
): Promise<void> {
  // External generation has finished. Lock only the persistence boundary, never IA.
  await prisma.$transaction(async (tx) => {
    const projects = await tx.$queryRaw<Array<{ organizationId: string }>>`
      SELECT "organizationId" FROM project WHERE id = ${projectId} AND "deletedAt" IS NULL FOR UPDATE`;
    const project = projects[0];
    if (!project) throw new Error('Proyecto no disponible para publicar el resultado');
    if (zoneId) {
      const zones = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM project_zone WHERE id = ${zoneId} AND "projectId" = ${projectId}
        AND "organizationId" = ${project.organizationId} AND "deletedAt" IS NULL FOR UPDATE`;
      if (!zones.length) throw new Error('Zona no disponible para publicar el resultado');
    }
    if (
      await tx.editorDocumentState.findFirst({ where: { projectId, zoneId }, select: { id: true } })
    ) {
      throw new Error('Resultado legacy rechazado: el plano fue migrado al editor v2');
    }
    if (
      sourceImageId &&
      !(await tx.sourceImage.findFirst({
        where: {
          id: sourceImageId,
          projectId,
          zoneId,
          organizationId: project.organizationId,
          deletedAt: null,
        },
        select: { id: true },
      }))
    )
      throw new Error('Imagen de origen fuera del ámbito del resultado');
    const existing = await tx.deliverable.findMany({
      where: { id: { in: deliverables.map((d) => d.id) } },
      select: { projectId: true, zoneId: true, deletedAt: true },
    });
    if (existing.some((d) => d.projectId !== projectId || d.zoneId !== zoneId || d.deletedAt)) {
      throw new Error('Entregable existente fuera del ámbito del resultado');
    }
    for (const d of deliverables) {
      const type = TYPE_TO_ENUM[d.type];
      if (!type) continue;
      const payload = d.payload as unknown as Prisma.InputJsonValue;
      const updated = await tx.deliverable.updateMany({
        where: { id: d.id, projectId, zoneId, deletedAt: null },
        data: { payload, version: d.version },
      });
      if (!updated.count)
        await tx.deliverable.create({
          data: {
            id: d.id,
            projectId,
            type,
            payload,
            legalSeal: d.legalSeal,
            version: d.version,
            ...(sourceImageId ? { sourceImageId } : {}),
            ...(zoneId ? { zoneId } : {}),
          },
        });
    }
  });
}
