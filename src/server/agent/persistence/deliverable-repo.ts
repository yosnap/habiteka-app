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

/** Guarda los entregables de un proyecto. Idempotente por id (upsert). */
export async function persistDeliverables(
  projectId: string,
  deliverables: Deliverable[],
): Promise<void> {
  for (const d of deliverables) {
    const type = TYPE_TO_ENUM[d.type];
    if (!type) continue;
    const payload = d.payload as unknown as Prisma.InputJsonValue;
    await prisma.deliverable.upsert({
      where: { id: d.id },
      create: { id: d.id, projectId, type, payload, legalSeal: d.legalSeal, version: d.version },
      update: { payload, version: d.version },
    });
  }
}
