/**
 * Gestión de salas de votación. Una sala se ancla a un entregable concreto y
 * expone sus elementos votables (las referencias estables que el agente ya
 * extrajo: puertas, azulejos, colores…). El add-on no reescanea el diseño, solo
 * consume esos elementos. El enlace compartible se deriva de un slug único.
 */
import type { DesignElement } from '@/lib/contracts';
import { prisma } from '@/server/db/prisma';

export interface VotableElement {
  targetRef: string;
  label: string;
}

/** Crea una sala desde un entregable (verificando que pertenece a la org). */
export async function createRoom(
  organizationId: string,
  deliverableId: string,
  title: string,
): Promise<{ roomId: string; shareSlug: string }> {
  const deliverable = await prisma.deliverable.findFirst({
    where: { id: deliverableId, project: { organizationId } },
    select: { projectId: true },
  });
  if (!deliverable) {
    throw new Error('Entregable no encontrado en la organización');
  }
  const shareSlug = globalThis.crypto.randomUUID();
  const room = await prisma.votingRoom.create({
    data: { projectId: deliverable.projectId, title, shareSlug },
    select: { id: true, shareSlug: true },
  });
  return { roomId: room.id, shareSlug: room.shareSlug };
}

/** Extrae los elementos votables de un entregable a partir de su payload. */
export function votableElementsFrom(elements: DesignElement[] | undefined): VotableElement[] {
  if (!elements) return [];
  return elements.map((e) => ({ targetRef: e.targetRef, label: e.label ?? e.kind }));
}

/** Resuelve una sala por su slug compartible (para abrir desde el enlace). */
export async function findRoomBySlug(shareSlug: string) {
  return prisma.votingRoom.findUnique({
    where: { shareSlug },
    select: { id: true, title: true, isOpen: true, projectId: true },
  });
}
