/**
 * Cupo de iteraciones gratis por entregable.
 *
 * Las primeras `N` iteraciones de feedback sobre un entregable que YA consumió
 * crédito son gratis. El contador NO es un campo nuevo: se deriva contando las
 * filas `Iteration` de ese entregable (DRY). Como el cupo es por `deliverableId`,
 * no se puede farmear creando entregables nuevos (cada uno cobra y trae su propio
 * cupo). `N` se lee en cada decisión desde la configuración (ajustable en caliente).
 */
import { prisma } from '@/server/db/prisma';

const DEFAULT_FREE_ITERATIONS = 3;

async function readFreeIterations(): Promise<number> {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: 'free_iterations_per_deliverable' },
  });
  const value = setting?.value;
  return typeof value === 'number' ? value : DEFAULT_FREE_ITERATIONS;
}

export interface FreeIterations {
  total: number;
  used: number;
  remaining: number;
}

/** Iteraciones gratis restantes de un entregable (deriva de `COUNT(Iteration)`). */
export async function freeIterationsRemaining(deliverableId: string): Promise<FreeIterations> {
  const total = await readFreeIterations();
  const used = await prisma.iteration.count({ where: { deliverableId } });
  return { total, used, remaining: Math.max(0, total - used) };
}

/** Verdadero si la próxima iteración del entregable entra dentro del cupo gratis. */
export async function isNextIterationFree(deliverableId: string): Promise<boolean> {
  const { remaining } = await freeIterationsRemaining(deliverableId);
  return remaining > 0;
}
