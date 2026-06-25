/**
 * Punto de entrada del agente. Cablea los adaptadores de IA (resueltos por
 * acción) y el servicio de débito real para una organización, y expone `advance`
 * ya provisto de esas dependencias. Sin estado por petición: cada llamada parte
 * del estado persistido.
 */
import type { AgentInput, AgentOutcome, ZoneDeliveryContext } from './orchestrator';
import { advance } from './orchestrator';
import { getChatVisionAdapter, getImageAdapter } from '@/server/ai';
import { createDebitService } from './debit-service-impl';

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
 * `resolveZoneContext` lo inyecta la capa con scope de org (Server Action), ya
 * acotado por organización: carga la foto de la zona (img2img) y su tipo pasando por
 * la única puerta anti-IDOR, sin que el agente conozca el `OrgContext` ni el storage.
 */
export async function getAgent(
  organizationId: string,
  userId: string,
  resolveZoneContext: (projectId: string, zoneId: string | null) => Promise<ZoneDeliveryContext>,
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
          resolveZoneContext,
          // Id ÚNICO por entregable. Antes un contador de módulo (`del-pid-type-N`)
          // que se reiniciaba en cada recarga del server → colisionaba con ids ya
          // existentes y el upsert PISABA entregables de otra zona (la zona nueva se
          // quedaba sin diseño). UUID elimina la colisión: cada generación es una fila
          // propia, atada a su zona e imagen de origen. (Mismo fallo que los ids del
          // canvas, ya resuelto allí con randomUUID.)
          newDeliverableId: (pid, type) => `del-${pid}-${type}-${globalThis.crypto.randomUUID()}`,
        },
        projectId,
        input,
        zoneId,
      );
    },
  };
}

export type { AgentInput, AgentOutcome, ZoneDeliveryContext } from './orchestrator';
export { AgentError } from './errors';
