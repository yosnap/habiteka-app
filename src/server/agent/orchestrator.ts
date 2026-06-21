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
  ReadyForDelivery,
  StructuralElements,
  Deliverable,
  DeliverableType,
  Estilo,
  ChatMessage,
  MessagePart,
} from '@/lib/contracts';
import { loadState, saveState } from './persistence/state-repo';
import { appendMessage } from './persistence/message-repo';
import { persistDeliverables } from './persistence/deliverable-repo';
import { assertTransition, isReadyForDelivery } from './state-machine';
import { runIngesta } from './phases/ingesta';
import { runQualification } from './phases/cualificacion';
import { runDelivery, explanationPrompt } from './phases/entrega';
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
  /**
   * Resuelve la imagen de origen (PRIMARY) que alimentó la entrega por chat, para
   * la trazabilidad origen→diseño. Devuelve null si el proyecto no tiene imagen
   * persistida. Ya viene acotado a la organización (lo inyecta la capa con scope).
   */
  resolveSourceImageId: (projectId: string) => Promise<string | null>;
}

// Inputs posibles de un turno, discriminados por acción.
export type AgentInput =
  | { action: 'ingest'; image: MessagePart[] }
  | { action: 'confirm-detection' }
  | { action: 'qualify'; history: ChatMessage[] }
  | { action: 'deliver' }
  // Generación desde el lienzo (CRL-4): flujo paralelo al chat. El usuario aporta
  // estilo y entregable en el propio canvas (mini-formulario), más la descripción
  // estructurada y la imagen rasterizada del lienzo. No avanza la fase del chat.
  | {
      action: 'generate-from-canvas';
      estilo: Estilo;
      entregable: DeliverableType;
      /** Objetivo opcional del usuario (paridad con el chat); '' si no se indicó. */
      objetivo: string;
      /** Instrucción libre en lenguaje natural ("haz la sala más cálida"); '' si no se indicó. */
      promptLibre: string;
      description: string;
      referenceImage: { base64: string; mimeType: string };
      /** Proporción de la sala (ancho:alto) para encuadrar el render. */
      aspectRatio: string;
      /**
       * Identificador único de ESTE intento de generación, creado por la Server
       * Action. Es la clave idempotente del cobro: cada clic de "Generar" trae uno
       * nuevo (operación cobrable), pero un reintento de red con el mismo id no
       * vuelve a cobrar. No se deriva de `version` (el flujo del lienzo no avanza la
       * fase del chat, así que `version` no varía entre generaciones).
       */
      requestId: string;
    };

export interface AgentOutcome {
  phase: string;
  collected: Collected;
  detected?: StructuralElements;
  disclaimer?: string;
  deliverables?: Deliverable[];
  /** Explicación en lenguaje natural de las decisiones del diseño (efímera, no se persiste). */
  explanation?: string;
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
    case 'generate-from-canvas':
      return handleGenerateFromCanvas(deps, projectId, state.collected, input);
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
  // Trazabilidad origen→diseño: vincula la entrega con la imagen de origen que el
  // usuario subió en la ingesta (PRIMARY más reciente del proyecto), si la hay.
  const sourceImageId = (await deps.resolveSourceImageId(projectId)) ?? undefined;
  // Persistir los entregables ANTES de avanzar de fase: la vista de «Diseños» los
  // lee de la base de datos; sin esto, la generación se perdería.
  await persistDeliverables(projectId, deliverables, sourceImageId);
  await saveState(projectId, version, { phase: 'feedback', collected });
  return { phase: 'feedback', collected, deliverables };
}

async function handleGenerateFromCanvas(
  deps: AgentDeps,
  projectId: string,
  collected: Collected,
  input: Extract<AgentInput, { action: 'generate-from-canvas' }>,
): Promise<AgentOutcome> {
  // El lienzo rasterizado es una imagen que se procesa con IA: mismo deber RGPD
  // que la ingesta de la foto. El gate corta antes de enviar nada al modelo.
  await assertConsent(deps.userId, 'IMAGE_PROCESSING');
  // Condición contractual idéntica a la entrega por chat: sin ToS aceptado no se
  // genera nada.
  await assertTosAccepted(deps.userId);

  // El estilo y el entregable los aporta el usuario en el canvas (mini-formulario),
  // no la cualificación del chat: se construye un Collected listo para entregar.
  const ready: ReadyForDelivery = {
    ...collected,
    // El objetivo del formulario tiene prioridad si se indicó; si no, lo ya recogido.
    objetivo: input.objetivo || collected.objetivo,
    estilo: input.estilo,
    entregables: [input.entregable],
  };

  const deliveryInput = {
    projectId,
    collected: ready,
    // Clave única por intento (no por versión, que aquí no avanza): cada clic de
    // "Generar" cobra; un reintento de red con el mismo `requestId` no recobra.
    // Prefijo `canvas:` distinto de `deliver:` para que ambos flujos coexistan.
    idempotencyKey: `canvas:${projectId}:${input.requestId}`,
    estimateCredits: 1000,
    sketch: {
      description: input.description,
      referenceImage: input.referenceImage,
      aspectRatio: input.aspectRatio,
      ...(input.promptLibre ? { promptLibre: input.promptLibre } : {}),
    },
  };

  const deliverables = await runDelivery(
    {
      chat: deps.chat,
      image: deps.image,
      debit: deps.debit,
      newId: (type) => deps.newDeliverableId(projectId, type),
    },
    deliveryInput,
  );

  await persistDeliverables(projectId, deliverables);

  // Si se generó un render, la IA explica sus decisiones (2ª llamada de chat,
  // barata). Es un extra: si falla, se devuelve el render igual (sin explicación).
  let explanation: string | undefined;
  if (deliverables.some((d) => d.payload.type === 'render3d')) {
    try {
      const result = await deps.chat.chat({
        model: '',
        messages: [
          { role: 'user', content: [{ type: 'text', text: explanationPrompt(deliveryInput) }] },
        ],
      });
      explanation = result.content.trim() || undefined;
    } catch {
      // La explicación es accesoria: nunca tumba la entrega del render.
    }
  }

  // NO se toca la fase del chat: la generación desde el lienzo es un flujo paralelo
  // y no debe pisar una conversación de cualificación en curso.
  return { phase: 'feedback', collected, deliverables, ...(explanation ? { explanation } : {}) };
}
