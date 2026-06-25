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
import { assertTransition, isReadyForDelivery, previousPhase } from './state-machine';
import { runIngesta } from './phases/ingesta';
import { runQualification } from './phases/cualificacion';
import { runDelivery, explanationPrompt } from './phases/entrega';
import { agentError } from './errors';
import { assertConsent } from '@/server/privacy/consent-service';
import { assertTosAccepted } from '@/server/legal/tos-acceptance-service';

/**
 * Contexto de la zona necesario para la entrega por chat: el tipo de zona (adapta el
 * prompt interior/exterior) y, si la hay, la foto PRIMARY de la zona como referencia
 * img2img (más su id para la trazabilidad origen→diseño). Lo resuelve la capa con
 * scope de org (carga los bytes del storage); el orquestador queda org-agnóstico.
 */
export interface ZoneDeliveryContext {
  /** Tipo de la zona (interior/exterior...); null si no hay zona o sin tipo. */
  zoneKind: string | null;
  /** Foto PRIMARY de la zona para img2img + su id; null si la zona no tiene foto. */
  reference: { sourceImageId: string; image: { base64: string; mimeType: string } } | null;
}

export interface AgentDeps {
  chat: ChatVisionAdapter;
  image: ImageAdapter;
  debit: DebitService;
  /** Usuario en cuyo nombre actúa el agente (gates de consentimiento/ToS). */
  userId: string;
  newDeliverableId: (projectId: string, type: string) => string;
  /**
   * Resuelve el contexto de la zona para la entrega por chat: tipo de zona + foto
   * PRIMARY (bytes para img2img) + su id (trazabilidad). Ya viene acotado a la
   * organización (lo inyecta la capa con scope). Devuelve `reference: null` cuando la
   * zona no tiene foto persistida (el render parte solo del estilo, como antes).
   */
  resolveZoneContext: (projectId: string, zoneId: string | null) => Promise<ZoneDeliveryContext>;
}

// Inputs posibles de un turno, discriminados por acción.
export type AgentInput =
  | { action: 'ingest'; image: MessagePart[] }
  | { action: 'confirm-detection' }
  // Corrige a mano lo detectado (la visión se equivocó) ANTES de confirmar. No avanza
  // de fase: sobrescribe `collected.detected` para que el plano base parta de números
  // correctos. Solo válido en ingesta.
  | { action: 'correct-detection'; detected: StructuralElements }
  // Avanza a cualificación SIN endosar la detección (era pobre, o la foto se subió por
  // el panel y no hubo análisis). Equivale a confirmar aceptando que es aproximada: el
  // usuario afinará el plano luego. Solo válido en ingesta.
  | { action: 'skip-detection' }
  // Vuelve al paso anterior (corregir sin perder lo recogido). Solo desde una fase con
  // anterior (cualificación→ingesta, feedback→cualificación).
  | { action: 'go-back' }
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
  zoneId: string | null = null,
): Promise<AgentOutcome> {
  const state = await loadState(projectId, zoneId);

  switch (input.action) {
    case 'ingest':
      return handleIngest(
        deps,
        projectId,
        zoneId,
        state.phase,
        state.collected,
        state.version,
        input.image,
      );
    case 'confirm-detection':
      return handleConfirm(projectId, zoneId, state.phase, state.collected, state.version);
    case 'correct-detection':
      return handleCorrectDetection(
        projectId,
        zoneId,
        state.phase,
        state.collected,
        state.version,
        input.detected,
      );
    case 'skip-detection':
      return handleSkipDetection(projectId, zoneId, state.phase, state.collected, state.version);
    case 'go-back':
      return handleGoBack(projectId, zoneId, state.phase, state.collected, state.version);
    case 'qualify':
      return handleQualify(
        deps,
        projectId,
        zoneId,
        state.phase,
        state.collected,
        state.version,
        input.history,
      );
    case 'deliver':
      return handleDeliver(deps, projectId, zoneId, state.phase, state.collected, state.version);
    case 'generate-from-canvas':
      return handleGenerateFromCanvas(deps, projectId, zoneId, state.collected, input);
  }
}

async function handleIngest(
  deps: AgentDeps,
  projectId: string,
  zoneId: string | null,
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
  await saveState(projectId, zoneId, version, { phase: 'ingesta', collected: nextCollected });
  await appendMessage(projectId, 'assistant', [{ type: 'text', text: disclaimer }]);
  return { phase: 'ingesta', collected: nextCollected, detected, disclaimer };
}

async function handleConfirm(
  projectId: string,
  zoneId: string | null,
  phase: string,
  collected: Collected,
  version: number,
): Promise<AgentOutcome> {
  assertTransition(phase as never, 'cualificacion', collected);
  await saveState(projectId, zoneId, version, { phase: 'cualificacion', collected });
  return { phase: 'cualificacion', collected };
}

/**
 * Corrige a mano lo detectado por visión antes de confirmar. No avanza de fase: deja
 * la ingesta con la detección saneada (enteros ≥ 0) para que el plano base y la
 * memoria partan de números correctos. El usuario confirma después.
 */
async function handleCorrectDetection(
  projectId: string,
  zoneId: string | null,
  phase: string,
  collected: Collected,
  version: number,
  detected: StructuralElements,
): Promise<AgentOutcome> {
  if (phase !== 'ingesta') {
    throw agentError('phase_guard', 'La detección solo se corrige durante la ingesta');
  }
  const clean = sanitizeElements(detected);
  const next: Collected = { ...collected, detected: clean };
  await saveState(projectId, zoneId, version, { phase: 'ingesta', collected: next });
  return { phase: 'ingesta', collected: next, detected: clean };
}

/**
 * Avanza a cualificación SIN endosar la detección. Sirve cuando la visión detectó mal
 * (el usuario afinará el plano luego) o cuando no hubo análisis porque la foto se subió
 * por el panel: se rellena una detección vacía para satisfacer el guard y poder seguir
 * hacia el render (que parte de la foto, no de estos números).
 */
async function handleSkipDetection(
  projectId: string,
  zoneId: string | null,
  phase: string,
  collected: Collected,
  version: number,
): Promise<AgentOutcome> {
  if (phase !== 'ingesta') {
    throw agentError('phase_guard', 'No se está en la ingesta');
  }
  const detected = collected.detected ?? { walls: 0, doors: 0, windows: 0, pillars: 0 };
  const next: Collected = { ...collected, detected };
  await saveState(projectId, zoneId, version, { phase: 'cualificacion', collected: next });
  return { phase: 'cualificacion', collected: next };
}

/**
 * Vuelve al paso anterior para corregir sin perder lo recogido (estilo, entregables,
 * detección). No cobra ni borra entregables ya generados: solo retrocede la fase. Falla
 * si no hay anterior (ingesta es el inicio; entrega/addons no son puntos de retorno).
 */
async function handleGoBack(
  projectId: string,
  zoneId: string | null,
  phase: string,
  collected: Collected,
  version: number,
): Promise<AgentOutcome> {
  const prev = previousPhase(phase as never);
  if (!prev) throw agentError('phase_guard', 'No hay un paso anterior al que volver');
  await saveState(projectId, zoneId, version, { phase: prev, collected });
  return { phase: prev, collected };
}

/** Sanea una detección recibida del cliente: enteros ≥ 0 (defensa de boundary). */
function sanitizeElements(e: StructuralElements): StructuralElements {
  const int = (v: unknown) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.trunc(v)) : 0;
  return { walls: int(e?.walls), doors: int(e?.doors), windows: int(e?.windows), pillars: int(e?.pillars) };
}

async function handleQualify(
  deps: AgentDeps,
  projectId: string,
  zoneId: string | null,
  phase: string,
  collected: Collected,
  version: number,
  history: ChatMessage[],
): Promise<AgentOutcome> {
  if (phase !== 'cualificacion') throw agentError('phase_guard', 'No se está cualificando');
  const { collected: next } = await runQualification(deps.chat, history, collected);
  await saveState(projectId, zoneId, version, { phase: 'cualificacion', collected: next });
  return { phase: 'cualificacion', collected: next };
}

async function handleDeliver(
  deps: AgentDeps,
  projectId: string,
  zoneId: string | null,
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
  // Contexto de la zona ANTES de generar: la foto PRIMARY condiciona el render
  // (img2img) y el tipo de zona adapta el prompt. Una sola resolución sirve a la
  // generación y, después, a la trazabilidad (su id).
  const zoneCtx = await deps.resolveZoneContext(projectId, zoneId);
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
      zoneKind: zoneCtx.zoneKind,
      // La foto de la zona (si existe) ancla el render a la estructura real.
      ...(zoneCtx.reference ? { referenceImage: zoneCtx.reference.image } : {}),
    },
  );
  // Trazabilidad origen→diseño: vincula la entrega con la imagen de origen que el
  // usuario subió en la ingesta de ESTA zona (PRIMARY más reciente), si la hay.
  const sourceImageId = zoneCtx.reference?.sourceImageId ?? undefined;
  // Persistir los entregables (de esta zona) ANTES de avanzar de fase: la vista de
  // «Diseños» los lee de la base de datos; sin esto, la generación se perdería.
  await persistDeliverables(projectId, deliverables, sourceImageId, zoneId);
  await saveState(projectId, zoneId, version, { phase: 'feedback', collected });
  return { phase: 'feedback', collected, deliverables };
}

async function handleGenerateFromCanvas(
  deps: AgentDeps,
  projectId: string,
  zoneId: string | null,
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

  await persistDeliverables(projectId, deliverables, undefined, zoneId);

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
