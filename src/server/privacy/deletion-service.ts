/**
 * Derecho de supresión (RGPD art. 17): borrado REAL del contenido de una
 * organización, no soft-delete.
 *
 * Orden importante: primero se borran los objetos en object storage (S3/MinIO)
 * y luego las filas en la base de datos. Si se borrase la DB antes, se perderían
 * las refs a los objetos y quedarían huérfanos en el bucket. El borrado de filas
 * se apoya en las claves foráneas `onDelete: Cascade`: borrar los Project elimina
 * en cascada conversaciones, mensajes, canvas, estado del agente, entregables e
 * iteraciones.
 *
 * Garantía: cero datos del usuario en sistemas PROPIOS (DB + storage). El borrado
 * en subencargados (OpenRouter, proveedor de imagen) es best-effort vía contrato
 * y NO se asevera aquí.
 */
import { prisma } from '@/server/db/prisma';
import type { StorageAdapter } from '@/server/storage/storage-adapter';
import { toStorageKey, storageKeyFromDeliverablePayload } from './storage-keys';

export interface DeletionReport {
  projectsDeleted: number;
  deliverablesDeleted: number;
  storageObjectsDeleted: number;
}

/** Reúne todas las claves de object storage referenciadas por la organización. */
async function collectStorageKeys(organizationId: string): Promise<string[]> {
  const deliverables = await prisma.deliverable.findMany({
    where: { project: { organizationId } },
    select: { id: true, payload: true },
  });

  const keys = new Set<string>();
  for (const d of deliverables) {
    const key = storageKeyFromDeliverablePayload(d.payload);
    if (key) keys.add(key);
  }

  const iterations = await prisma.iteration.findMany({
    where: { deliverable: { project: { organizationId } } },
    select: { resultRef: true },
  });
  for (const it of iterations) {
    const key = toStorageKey(it.resultRef);
    if (key) keys.add(key);
  }

  // Imágenes de origen subidas por el usuario (dato personal): sus binarios viven
  // en storage y deben borrarse también, no solo las filas (que caen por cascade).
  const sourceImages = await prisma.sourceImage.findMany({
    where: { organizationId },
    select: { key: true },
  });
  for (const img of sourceImages) {
    const key = toStorageKey(img.key);
    if (key) keys.add(key);
  }

  return [...keys];
}

/**
 * Borra TODO el contenido de la organización de forma irreversible: objetos en
 * storage primero, luego filas (cascade desde Project). Devuelve un parte del
 * borrado para auditoría.
 */
export async function eraseOrganizationData(
  storage: StorageAdapter,
  organizationId: string,
): Promise<DeletionReport> {
  const keys = await collectStorageKeys(organizationId);

  // Borrado de objetos en storage. Un fallo en un objeto no debe abortar el
  // resto del borrado de PII: se intenta cada uno y se cuenta lo logrado.
  let storageObjectsDeleted = 0;
  for (const key of keys) {
    try {
      await storage.delete(key);
      storageObjectsDeleted++;
    } catch {
      // best-effort por objeto: continúa con los demás.
    }
  }

  // Hard-delete de las filas. `deleteMany` sobre Project dispara el cascade que
  // elimina conversaciones, mensajes, canvas, estado del agente, entregables e
  // iteraciones de la organización.
  const deliverableCount = await prisma.deliverable.count({
    where: { project: { organizationId } },
  });
  const projects = await prisma.project.deleteMany({ where: { organizationId } });

  return {
    projectsDeleted: projects.count,
    deliverablesDeleted: deliverableCount,
    storageObjectsDeleted,
  };
}
