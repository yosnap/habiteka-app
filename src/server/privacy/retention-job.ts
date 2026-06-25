/**
 * Purga por retención: convierte soft-deletes vencidos en hard-deletes.
 *
 * El soft-delete (`deletedAt`) mantiene el contenido en la papelera durante un
 * tiempo (deshacer, soporte). Pasado el TTL, el dato debe desaparecer de verdad
 * (minimización, art. 5.1.e). Este job borra de forma real lo que lleva
 * soft-deleted más tiempo que el TTL, incluidos sus objetos en storage.
 *
 * El reloj y el TTL son parámetros para poder probar el corte temporal sin
 * depender de la hora real.
 */
import { prisma } from '@/server/db/prisma';
import type { StorageAdapter } from '@/server/storage/storage-adapter';
import { toStorageKey, storageKeyFromDeliverablePayload } from './storage-keys';

/** TTL por defecto de la papelera: 30 días. */
export const DEFAULT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export interface RetentionResult {
  projectsPurged: number;
  deliverablesPurged: number;
  storageObjectsDeleted: number;
}

export interface RetentionOptions {
  now?: Date;
  ttlMs?: number;
}

export async function purgeExpiredSoftDeletes(
  storage: StorageAdapter,
  options: RetentionOptions = {},
): Promise<RetentionResult> {
  const now = options.now ?? new Date();
  const ttlMs = options.ttlMs ?? DEFAULT_RETENTION_MS;
  const cutoff = new Date(now.getTime() - ttlMs);

  // Entregables soft-deleted vencidos (sueltos, sin que su proyecto lo esté).
  const deliverables = await prisma.deliverable.findMany({
    where: { deletedAt: { not: null, lt: cutoff } },
    select: { id: true, payload: true },
  });

  // Proyectos soft-deleted vencidos: arrastran su contenido por cascade.
  const projects = await prisma.project.findMany({
    where: { deletedAt: { not: null, lt: cutoff } },
    select: { id: true },
  });
  const projectIds = projects.map((p) => p.id);

  // Refs de storage a borrar: las de los entregables sueltos vencidos y las de
  // todos los entregables/iteraciones que cuelgan de los proyectos vencidos.
  const keys = new Set<string>();
  for (const d of deliverables) {
    const key = storageKeyFromDeliverablePayload(d.payload);
    if (key) keys.add(key);
  }
  if (projectIds.length > 0) {
    const childDeliverables = await prisma.deliverable.findMany({
      where: { projectId: { in: projectIds } },
      select: { payload: true },
    });
    for (const d of childDeliverables) {
      const key = storageKeyFromDeliverablePayload(d.payload);
      if (key) keys.add(key);
    }
    const iterations = await prisma.iteration.findMany({
      where: { deliverable: { projectId: { in: projectIds } } },
      select: { resultRef: true },
    });
    for (const it of iterations) {
      const key = toStorageKey(it.resultRef);
      if (key) keys.add(key);
    }
    // Imágenes de origen de los proyectos vencidos: sus binarios en storage también.
    const sourceImages = await prisma.sourceImage.findMany({
      where: { projectId: { in: projectIds } },
      select: { key: true },
    });
    for (const img of sourceImages) {
      const key = toStorageKey(img.key);
      if (key) keys.add(key);
    }
  }

  let storageObjectsDeleted = 0;
  for (const key of keys) {
    try {
      await storage.delete(key);
      storageObjectsDeleted++;
    } catch {
      // best-effort por objeto.
    }
  }

  // Hard-delete real. Los entregables sueltos primero; luego los proyectos
  // (cascade elimina sus entregables/iteraciones restantes).
  const deletedDeliverables = await prisma.deliverable.deleteMany({
    where: { deletedAt: { not: null, lt: cutoff } },
  });
  const deletedProjects = await prisma.project.deleteMany({
    where: { deletedAt: { not: null, lt: cutoff } },
  });

  return {
    projectsPurged: deletedProjects.count,
    deliverablesPurged: deletedDeliverables.count,
    storageObjectsDeleted,
  };
}
