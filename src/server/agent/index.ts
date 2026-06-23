/**
 * Punto de entrada del agente. Cablea los adaptadores de IA (resueltos por
 * acción) y el servicio de débito real para una organización, y expone `advance`
 * ya provisto de esas dependencias. Sin estado por petición: cada llamada parte
 * del estado persistido.
 */
import type { AgentInput, AgentOutcome } from './orchestrator';
import { advance } from './orchestrator';
import { getChatVisionAdapter, getImageAdapter } from '@/server/ai';
import { createDebitService } from './debit-service-impl';

let deliverableSeq = 0;

export interface AgentSession {
  advance(
    projectId: string,
    input: AgentInput,
    zoneId?: string | null,
  ): Promise<AgentOutcome>;
}

/**
 * Crea una sesión de agente para una organización. Las dependencias de IA y de
 * débito quedan cableadas; el despacho por fase lo hace el orquestador.
 *
 * `resolveSourceImageId` lo inyecta la capa con scope de org (Server Action), ya
 * acotado por organización: así la query de trazabilidad sigue pasando por la
 * única puerta anti-IDOR sin que el agente conozca el `OrgContext`.
 */
export async function getAgent(
  organizationId: string,
  userId: string,
  resolveSourceImageId: (projectId: string, zoneId: string | null) => Promise<string | null>,
): Promise<AgentSession> {
  // El modelo de chat se resuelve por la acción 'chat'; las fases que necesiten
  // otra acción (visión) la piden a su propio adaptador en el futuro.
  const chat = await getChatVisionAdapter({ organizationId }, 'chat');
  const image = getImageAdapter({ organizationId });
  const debit = createDebitService(organizationId);

  return {
    advance(projectId, input, zoneId = null) {
      return advance(
        {
          chat,
          image,
          debit,
          userId,
          resolveSourceImageId,
          newDeliverableId: (pid, type) => {
            deliverableSeq += 1;
            return `del-${pid}-${type}-${deliverableSeq}`;
          },
        },
        projectId,
        input,
        zoneId,
      );
    },
  };
}

export type { AgentInput, AgentOutcome } from './orchestrator';
export { AgentError } from './errors';
