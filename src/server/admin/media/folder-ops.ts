/**
 * Gestión de carpetas de media (jerarquía con `parentId`).
 *
 * La operación delicada es mover: hay que impedir que una carpeta acabe dentro de
 * uno de sus propios descendientes, lo que crearía un ciclo y dejaría una rama
 * inalcanzable. Antes de mover se comprueba que el destino no cuelga de la carpeta
 * que se mueve.
 */
import { prisma } from '@/server/db/prisma';
import { writeAudit } from '../audit';

export class FolderCycleError extends Error {
  constructor() {
    super('No se puede mover una carpeta dentro de sí misma o de un descendiente');
    this.name = 'FolderCycleError';
  }
}

export async function createFolder(
  actorId: string,
  name: string,
  parentId?: string,
): Promise<{ id: string }> {
  const folder = await prisma.mediaFolder.create({ data: { name, parentId: parentId ?? null } });
  await writeAudit({
    actorId,
    action: 'create_folder',
    targetType: 'media_folder',
    targetId: folder.id,
  });
  return { id: folder.id };
}

/** Mueve una carpeta bajo otra (o a la raíz), rechazando ciclos. */
export async function moveFolder(
  actorId: string,
  folderId: string,
  newParentId: string | null,
): Promise<void> {
  if (newParentId) {
    if (newParentId === folderId || (await isDescendant(newParentId, folderId))) {
      throw new FolderCycleError();
    }
  }
  await prisma.mediaFolder.update({ where: { id: folderId }, data: { parentId: newParentId } });
  await writeAudit({
    actorId,
    action: 'move_folder',
    targetType: 'media_folder',
    targetId: folderId,
  });
}

/** Verdadero si `candidate` es descendiente de `ancestor` en la jerarquía. */
async function isDescendant(candidate: string, ancestor: string): Promise<boolean> {
  let current: string | null = candidate;
  // Recorre hacia arriba: si encuentra al ancestro, candidate cuelga de él.
  while (current) {
    const node: { parentId: string | null } | null = await prisma.mediaFolder.findUnique({
      where: { id: current },
      select: { parentId: true },
    });
    if (!node) return false;
    if (node.parentId === ancestor) return true;
    current = node.parentId;
  }
  return false;
}
