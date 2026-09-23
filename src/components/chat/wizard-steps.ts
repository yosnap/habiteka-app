/**
 * Lógica pura del asistente por pasos: qué paso corresponde a cada fase del agente
 * y si se puede avanzar desde un paso con lo elegido hasta ahora.
 *
 * Vive fuera del componente para poder probarla sin montar React: el mapeo
 * fase → paso es la costura entre el servidor (fuente de verdad) y la UI.
 */
import type { DeliverableType, Estilo } from '@/lib/contracts';

export type Phase = 'ingesta' | 'cualificacion' | 'entrega' | 'feedback';

export type StepId = 1 | 2 | 3 | 4 | 5 | 6;

export const STEPS: ReadonlyArray<{ id: StepId; title: string }> = [
  { id: 1, title: 'Tu espacio' },
  { id: 2, title: 'Revisa lo detectado' },
  { id: 3, title: 'Estilo' },
  { id: 4, title: 'Qué quieres recibir' },
  { id: 5, title: 'Detalles y confirmación' },
  { id: 6, title: 'Resultado' },
];

/** Selección acumulada del usuario (reflejo de `collected` del servidor). */
export interface WizardSelection {
  estilo?: Estilo;
  entregables: DeliverableType[];
}

/**
 * Paso que toca según la fase persistida. En ingesta depende de si ya hay una
 * detección que revisar (paso 2) o aún no se ha subido nada (paso 1). La fase
 * `entrega` es transitoria: se muestra el paso de confirmación, que es donde vive
 * el estado "generando…".
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

/** ¿Se puede salir de este paso hacia el siguiente con lo elegido? */
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

/** Lo que el asistente sabe para decidir a qué pasos se puede saltar. */
export interface ReachContext {
  phase: Phase;
  hasDetection: boolean;
  selection: WizardSelection;
}

/**
 * ¿Se puede ir a este paso desde la cabecera? Solo a pasos cuyos datos previos ya
 * están completos y que la fase del servidor admite (volver atrás en el servidor lo
 * hace el asistente con `go-back`). Durante la generación no se navega.
 */
export function isStepReachable(destino: StepId, ctx: ReachContext): boolean {
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
