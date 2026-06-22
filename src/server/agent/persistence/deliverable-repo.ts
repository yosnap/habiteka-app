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
): Promise<void> {
  for (const d of deliverables) {
    const type = TYPE_TO_ENUM[d.type];
    if (!type) continue;
    const payload = d.payload as unknown as Prisma.InputJsonValue;
    await prisma.deliverable.upsert({
      where: { id: d.id },
      create: {
        id: d.id,
        projectId,
        type,
        payload,
        legalSeal: d.legalSeal,
        version: d.version,
        ...(sourceImageId ? { sourceImageId } : {}),
      },
      update: { payload, version: d.version },
    });
  }
}
