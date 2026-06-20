/**
 * Versionado transaccional de las iteraciones de feedback.
 *
 * Cada iteración crea una NUEVA versión del entregable (no muta la anterior) y
 * una fila `Iteration` que registra la zona y la instrucción. Las versiones
 * previas quedan intactas y recuperables. La operación es atómica: o se crean la
 * versión y su iteración, o no se crea nada. El acceso pasa por la organización
 * (anti-IDOR): no se itera sobre un entregable de otra org.
 */
import type { Prisma, DeliverableType } from '@/generated/prisma/client';
import { prisma } from '@/server/db/prisma';
import { DELIVERABLE_LEGAL_SEAL } from '../legal/seal';

// Mapeo entre la forma del contrato (minúscula, serializable) y el enum de la
// base de datos (mayúscula). El contrato es la frontera neutral; el enum, el
// detalle de persistencia.
const TYPE_TO_ENUM: Record<string, DeliverableType> = {
  plano2d: 'PLANO_2D',
  render3d: 'RENDER_3D',
  memoria: 'MEMORIA',
};

function toEnumType(type: string): DeliverableType {
  const mapped = TYPE_TO_ENUM[type];
  if (!mapped) throw new Error(`Tipo de entregable desconocido: ${type}`);
  return mapped;
}

export class DeliverableNotFoundError extends Error {
  constructor() {
    super('Entregable no encontrado en la organización');
    this.name = 'DeliverableNotFoundError';
  }
}

export interface LoadedDeliverable {
  id: string;
  projectId: string;
  type: string;
  payload: unknown;
  version: number;
}

/** Carga un entregable verificando que pertenece a la organización. */
export async function loadDeliverable(
  organizationId: string,
  deliverableId: string,
): Promise<LoadedDeliverable> {
  const row = await prisma.deliverable.findFirst({
    where: { id: deliverableId, project: { organizationId } },
    select: { id: true, projectId: true, type: true, payload: true, version: true },
  });
  if (!row) throw new DeliverableNotFoundError();
  return row;
}

export interface IterationInput {
  organizationId: string;
  deliverableId: string;
  zone: unknown;
  instruction: string;
  /** Payload regenerado del nuevo entregable (render/plano). */
  newPayload: Prisma.InputJsonValue;
  newType: string;
}

export interface IterationResult {
  newDeliverableId: string;
  version: number;
}

/**
 * Crea la nueva versión + la fila de iteración en una transacción. El número de
 * versión se deriva del máximo existente para ese proyecto/tipo, así que dos
 * iteraciones no comparten versión. El sello legal se reaplica server-side.
 */
export async function createIteration(input: IterationInput): Promise<IterationResult> {
  return prisma.$transaction(async (tx) => {
    const current = await tx.deliverable.findFirst({
      where: { id: input.deliverableId, project: { organizationId: input.organizationId } },
      select: { id: true, projectId: true },
    });
    if (!current) throw new DeliverableNotFoundError();

    // Versión siguiente = (máxima del proyecto para ese tipo) + 1.
    const enumType = toEnumType(input.newType);
    const max = await tx.deliverable.aggregate({
      where: { projectId: current.projectId, type: enumType },
      _max: { version: true },
    });
    const nextVersion = (max._max.version ?? 0) + 1;

    const created = await tx.deliverable.create({
      data: {
        projectId: current.projectId,
        type: enumType,
        payload: input.newPayload,
        legalSeal: DELIVERABLE_LEGAL_SEAL,
        version: nextVersion,
      },
      select: { id: true, version: true },
    });

    await tx.iteration.create({
      data: {
        deliverableId: input.deliverableId,
        zone: input.zone as Prisma.InputJsonValue,
        instruction: input.instruction,
        resultRef: created.id,
      },
    });

    return { newDeliverableId: created.id, version: created.version };
  });
}

/** Historial de iteraciones de un entregable (de la org), más recientes primero. */
export async function listIterations(organizationId: string, deliverableId: string) {
  return prisma.iteration.findMany({
    where: { deliverableId, deliverable: { project: { organizationId } } },
    select: { id: true, instruction: true, resultRef: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
}
