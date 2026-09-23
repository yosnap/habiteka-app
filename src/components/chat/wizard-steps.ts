/**
 * Lógica pura del asistente por pasos: qué pasos tiene cada ruta, cuál
 * corresponde a la fase del agente y a qué paso se puede saltar con lo hecho
 * hasta ahora.
 *
 * Vive fuera del componente para poder probarla sin montar React: el mapeo
 * fase → paso es la costura entre el servidor (fuente de verdad) y la UI.
 *
 * Hay dos rutas, elegidas en el paso 0 (`intent`):
 * - `design`: crear un diseño a partir de una foto (seis pasos, flujo histórico).
 * - `plan`: convertir un plano al editor (subir → revisar fiabilidad → siguientes pasos).
 */
import type { AssistantIntent, DeliverableType, Estilo } from '@/lib/contracts';

export type Phase = 'ingesta' | 'cualificacion' | 'entrega' | 'feedback';

/** 0 = paso de intención (sin ruta elegida todavía); 1..6 = pasos de la ruta. */
export type StepId = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface WizardStep {
  id: StepId;
  title: string;
}

export const DESIGN_STEPS: ReadonlyArray<WizardStep> = [
  { id: 1, title: 'Tu espacio' },
  { id: 2, title: 'Revisa lo detectado' },
  { id: 3, title: 'Estilo' },
  { id: 4, title: 'Qué quieres recibir' },
  { id: 5, title: 'Detalles y confirmación' },
  { id: 6, title: 'Resultado' },
];

export const PLAN_STEPS: ReadonlyArray<WizardStep> = [
  { id: 1, title: 'Sube tu plano' },
  { id: 2, title: 'Revisa tu plano' },
  { id: 3, title: 'Siguientes pasos' },
];

/** Pasos que se muestran en la cabecera según la ruta elegida. */
export function stepsFor(intent: AssistantIntent): ReadonlyArray<WizardStep> {
  return intent === 'plan' ? PLAN_STEPS : DESIGN_STEPS;
}

/** Título de un paso de una ruta (para el encabezado de cada pantalla). */
export function stepTitle(intent: AssistantIntent, step: StepId): string {
  return stepsFor(intent).find((s) => s.id === step)?.title ?? '';
}

/** Selección acumulada del usuario (reflejo de `collected` del servidor). */
export interface WizardSelection {
  estilo?: Estilo;
  entregables: DeliverableType[];
}

/**
 * Paso que toca según la fase persistida en la ruta de diseño. En ingesta depende
 * de si ya hay una detección que revisar (paso 2) o aún no se ha subido nada
 * (paso 1). La fase `entrega` es transitoria: se muestra el paso de confirmación,
 * que es donde vive el estado "generando…".
 */
export function stepFromPhase(phase: Phase, hasDetection: boolean): StepId {
  switch (phase) {
    case 'ingesta':
      return hasDetection ? 2 : 1;
    case 'cualificacion':
      return 3;
    case 'entrega':
      return 5;
    case 'feedback':
      return 6;
  }
}

/** Lo que el asistente sabe de la ruta del plano para decidir qué es accesible. */
export interface PlanRouteState {
  /** Ya hay un plano leído y evaluado. */
  hasImport: boolean;
  /** La importación ya se ha llevado al editor. */
  applied: boolean;
}

/**
 * Paso que toca en la ruta del plano. La fase del agente no avanza aquí (la
 * lectura del plano no cualifica nada), así que el paso sale del propio avance.
 */
export function planStepFromState(state: PlanRouteState): StepId {
  if (state.applied) return 3;
  return state.hasImport ? 2 : 1;
}

/** ¿Se puede salir de este paso hacia el siguiente con lo elegido? (ruta de diseño) */
export function canAdvanceFrom(step: StepId, selection: WizardSelection): boolean {
  if (step === 3) return selection.estilo !== undefined;
  if (step === 4) return selection.entregables.length > 0;
  return true;
}

/**
 * Motivo por el que aún no se puede generar, o null si todo está listo. Se usa como
 * ayuda en pantalla; las guardas reales son del servidor.
 */
export function missingForGenerate(
  selection: WizardSelection,
  tosAccepted: boolean | null,
): string | null {
  if (selection.estilo === undefined) return 'Elige un estilo en el paso 3.';
  if (selection.entregables.length === 0) return 'Elige al menos un entregable en el paso 4.';
  if (tosAccepted !== true) return 'Acepta los Términos para poder generar.';
  return null;
}

/** Enlace a la pestaña «Diseños» conservando la zona activa. */
export function deliverablesHref(projectId: string, zoneId: string | null): string {
  return `/projects/${projectId}/deliverables${zoneId ? `?zona=${zoneId}` : ''}`;
}

/** Enlace al editor del proyecto conservando la zona activa. */
export function editorHref(projectId: string, zoneId: string | null): string {
  return `/projects/${projectId}${zoneId ? `?zona=${zoneId}` : ''}`;
}

/** Lo que el asistente sabe para decidir a qué pasos se puede saltar. */
export type ReachContext =
  | {
      intent: 'design';
      phase: Phase;
      hasDetection: boolean;
      selection: WizardSelection;
    }
  | ({ intent: 'plan' } & PlanRouteState);

/**
 * ¿Se puede ir a este paso desde la cabecera? Solo a pasos cuyos datos previos ya
 * están completos y que la ruta admite (volver atrás en el servidor lo hace el
 * asistente con `go-back`). Durante la generación no se navega.
 */
export function isStepReachable(destino: StepId, ctx: ReachContext): boolean {
  if (ctx.intent === 'plan') return isPlanStepReachable(destino, ctx);
  const { phase, hasDetection, selection } = ctx;
  const hasStyle = selection.estilo !== undefined;
  const hasDeliverables = selection.entregables.length > 0;
  switch (phase) {
    case 'ingesta':
      // Con detección, saltar adelante la confirma; sin ella solo cabe subir la imagen.
      if (destino === 1) return true;
      if (!hasDetection) return false;
      if (destino <= 3) return true;
      if (destino === 4) return hasStyle;
      if (destino === 5) return hasStyle && hasDeliverables;
      return false;
    case 'cualificacion':
      if (destino <= 3) return true;
      if (destino === 4) return hasStyle;
      if (destino === 5) return hasStyle && hasDeliverables;
      return false;
    case 'feedback':
      if (destino === 6 || destino === 3) return true;
      if (destino === 4) return hasStyle;
      if (destino === 5) return hasStyle && hasDeliverables;
      return false;
    case 'entrega':
      return false;
  }
}

/**
 * Ruta del plano: al paso 2 solo con un plano ya leído y al 3 solo cuando se ha
 * llevado al editor. Volver al paso 1 siempre vale (subir otro plano).
 */
function isPlanStepReachable(destino: StepId, state: PlanRouteState): boolean {
  if (destino === 1) return true;
  if (destino === 2) return state.hasImport;
  if (destino === 3) return state.applied;
  return false;
}
