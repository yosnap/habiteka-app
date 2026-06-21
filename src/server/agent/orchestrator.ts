/**
 * Orquestador del agente: resuelve la fase actual de un proyecto, ejecuta el
 * trabajo correspondiente al input recibido, persiste el resultado y transiciona
 * con sus guardas. Es stateless por petición: el estado vive en la base de datos.
 */
import type {
  ChatVisionAdapter,
  ImageAdapter,
  DebitService,
  Collected,
  StructuralElements,
  Deliverable,
  ChatMessage,
  MessagePart,
} from '@/lib/contracts';
import { loadState, saveState } from './persistence/state-repo';
import { appendMessage } from './persistence/message-repo';
import { persistDeliverables } from './persistence/deliverable-repo';
import { assertTransition, isReadyForDelivery } from './state-machine';
import { runIngesta } from './phases/ingesta';
import { runQualification } from './phases/cualificacion';
import { runDelivery } from './phases/entrega';
import { agentError } from './errors';
import { assertConsent } from '@/server/privacy/consent-service';
import { assertTosAccepted } from '@/server/legal/tos-acceptance-service';

export interface AgentDeps {
  chat: ChatVisionAdapter;
  image: ImageAdapter;
  debit: DebitService;
  /** Usuario en cuyo nombre actúa el agente (gates de consentimiento/ToS). */
  userId: string;
  newDeliverableId: (projectId: string, type: string) => string;
}

// Inputs posibles de un turno, discriminados por acción.
export type AgentInput =
  | { action: 'ingest'; image: MessagePart[] }
  | { action: 'confirm-detection' }
  | { action: 'qualify'; history: ChatMessage[] }
  | { action: 'deliver' };

export interface AgentOutcome {
  phase: string;
  collected: Collected;
  detected?: StructuralElements;
  disclaimer?: string;
  deliverables?: Deliverable[];
}

export async function advance(
  deps: AgentDeps,
  projectId: string,
  input: AgentInput,
): Promise<AgentOutcome> {
  const state = await loadState(projectId);

  switch (input.action) {
    case 'ingest':
      return handleIngest(
        deps,
        projectId,
        state.phase,
        state.collected,
        state.version,
        input.image,
      );
    case 'confirm-detection':
      return handleConfirm(projectId, state.phase, state.collected, state.version);
    case 'qualify':
      return handleQualify(
        deps,
        projectId,
        state.phase,
        state.collected,
        state.version,
        input.history,
      );
    case 'deliver':
      return handleDeliver(deps, projectId, state.phase, state.collected, state.version);
  }
}

async function handleIngest(
  deps: AgentDeps,
  projectId: string,
  phase: string,
  collected: Collected,
  version: number,
  image: MessagePart[],
): Promise<AgentOutcome> {
  if (phase !== 'ingesta') throw agentError('phase_guard', 'La ingesta ya se completó');
  // Minimización/base legal: no se trata la imagen sin consentimiento explícito
  // (RGPD). El gate corta antes de enviar nada al modelo de visión.
  await assertConsent(deps.userId, 'IMAGE_PROCESSING');
  const { detected, disclaimer } = await runIngesta(deps.chat, image);
  const nextCollected: Collected = { ...collected, detected };
  // Permanece en ingesta hasta que el usuario confirme lo detectado.
  await saveState(projectId, version, { phase: 'ingesta', collected: nextCollected });
  await appendMessage(projectId, 'assistant', [{ type: 'text', text: disclaimer }]);
  return { phase: 'ingesta', collected: nextCollected, detected, disclaimer };
}

async function handleConfirm(
  projectId: string,
  phase: string,
  collected: Collected,
  version: number,
): Promise<AgentOutcome> {
  assertTransition(phase as never, 'cualificacion', collected);
  await saveState(projectId, version, { phase: 'cualificacion', collected });
  return { phase: 'cualificacion', collected };
}

async function handleQualify(
  deps: AgentDeps,
  projectId: string,
  phase: string,
  collected: Collected,
  version: number,
  history: ChatMessage[],
): Promise<AgentOutcome> {
  if (phase !== 'cualificacion') throw agentError('phase_guard', 'No se está cualificando');
  const { collected: next } = await runQualification(deps.chat, history, collected);
  await saveState(projectId, version, { phase: 'cualificacion', collected: next });
  return { phase: 'cualificacion', collected: next };
}

async function handleDeliver(
  deps: AgentDeps,
  projectId: string,
  phase: string,
  collected: Collected,
  version: number,
): Promise<AgentOutcome> {
  // El guard legal corta aquí si falta estilo o entregables: la IA de generación
  // no llega a invocarse.
  assertTransition(phase as never, 'entrega', collected);
  if (!isReadyForDelivery(collected)) {
    throw agentError('legal_block', 'Requisitos incompletos para la entrega');
  }
  // Condición contractual: no se genera ningún entregable sin aceptación del ToS
  // vigente (limitación de responsabilidad + validación profesional).
  await assertTosAccepted(deps.userId);
  const deliverables = await runDelivery(
    {
      chat: deps.chat,
      image: deps.image,
      debit: deps.debit,
      newId: (type) => deps.newDeliverableId(projectId, type),
    },
    {
      projectId,
      collected,
      elements: collected.detected,
      idempotencyKey: `deliver:${projectId}:v${version}`,
      estimateCredits: 1000,
    },
  );
  // Persistir los entregables ANTES de avanzar de fase: la vista de «Diseños» los
  // lee de la base de datos; sin esto, la generación se perdería.
  await persistDeliverables(projectId, deliverables);
  await saveState(projectId, version, { phase: 'feedback', collected });
  return { phase: 'feedback', collected, deliverables };
}
