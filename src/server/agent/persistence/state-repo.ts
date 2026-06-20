/**
 * Persistencia del estado de fase del agente con bloqueo optimista.
 *
 * El estado vive en la base de datos (el orquestador es stateless): se carga al
 * empezar un turno y se guarda con la `version` esperada. Si entre la lectura y
 * la escritura otro turno avanzó el estado, la actualización condicional no
 * afecta a ninguna fila y se reporta un conflicto — así dos turnos concurrentes
 * no producen una doble entrega.
 */
import type { AgentPhase, Collected } from '@/lib/contracts';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/server/db/prisma';
import { agentError } from '../errors';

// `Collected` es serializable pero su tipo no lleva la firma de índice que Prisma
// espera para JSONB; este puente acota el cast a un único punto.
function toJson(collected: Collected): Prisma.InputJsonValue {
  return collected as unknown as Prisma.InputJsonValue;
}

export interface LoadedState {
  phase: AgentPhase;
  collected: Collected;
  version: number;
}

const EMPTY_COLLECTED: Collected = { entregables: [] };

/** Carga el estado del proyecto, creándolo en `ingesta` si aún no existe. */
export async function loadState(projectId: string): Promise<LoadedState> {
  const row = await prisma.agentState.findUnique({ where: { projectId } });
  if (!row) {
    const created = await prisma.agentState.create({
      data: { projectId, phase: 'ingesta', collected: toJson(EMPTY_COLLECTED) },
    });
    return { phase: 'ingesta', collected: EMPTY_COLLECTED, version: created.version };
  }
  return {
    phase: row.phase as AgentPhase,
    collected: row.collected as unknown as Collected,
    version: row.version,
  };
}

/**
 * Guarda fase y `collected` exigiendo la `version` leída. Devuelve la nueva
 * versión; lanza `AgentError('conflict')` si otro turno se adelantó.
 */
export async function saveState(
  projectId: string,
  expectedVersion: number,
  next: { phase: AgentPhase; collected: Collected },
): Promise<number> {
  const result = await prisma.agentState.updateMany({
    where: { projectId, version: expectedVersion },
    data: {
      phase: next.phase,
      collected: toJson(next.collected),
      version: { increment: 1 },
    },
  });
  if (result.count === 0) {
    throw agentError('conflict', 'El estado del proyecto cambió en otro turno');
  }
  return expectedVersion + 1;
}
