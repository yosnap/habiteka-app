/**
 * Máquina de estados de las cinco fases del agente y sus guardas.
 *
 * Las transiciones son un grafo dirigido con un bucle en feedback. Cada
 * transición valida precondiciones de dominio; la más importante es el guard
 * legal: no se entra en Entrega sin un estilo y al menos un entregable elegidos.
 * Estas reglas viven en el servidor y no dependen de que el modelo las respete.
 */
import type { AgentPhase, Collected, ReadyForDelivery } from '@/lib/contracts';
import { agentError } from './errors';

// Transiciones permitidas desde cada fase.
const TRANSITIONS: Record<AgentPhase, AgentPhase[]> = {
  ingesta: ['cualificacion'],
  cualificacion: ['entrega'],
  entrega: ['feedback'],
  feedback: ['entrega', 'addons'],
  addons: [],
};

export function canTransition(from: AgentPhase, to: AgentPhase): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Verdadero si `collected` cumple el guard legal de entrega (estilo + entregables). */
export function isReadyForDelivery(collected: Collected): collected is ReadyForDelivery {
  return collected.estilo !== undefined && collected.entregables.length > 0;
}

/** Verdadero si la detección de la ingesta fue confirmada por el usuario. */
export function isDetectionConfirmed(collected: Collected): boolean {
  return collected.detected !== undefined;
}

/**
 * Valida una transición concreta. Lanza `AgentError` con la causa precisa si la
 * transición no está permitida o una guarda de dominio falla.
 */
export function assertTransition(from: AgentPhase, to: AgentPhase, collected: Collected): void {
  if (!canTransition(from, to)) {
    throw agentError('phase_guard', `Transición no permitida: ${from} → ${to}`);
  }
  // Salir de la ingesta exige que el usuario haya confirmado lo detectado, para
  // no gastar créditos sobre un análisis erróneo.
  if (from === 'ingesta' && to === 'cualificacion' && !isDetectionConfirmed(collected)) {
    throw agentError('not_confirmed', 'La detección del espacio no está confirmada');
  }
  // Entrar en Entrega exige el guard legal: estilo + al menos un entregable.
  if (to === 'entrega' && !isReadyForDelivery(collected)) {
    throw agentError('legal_block', 'Falta estilo o tipo de entregable validado en el chat');
  }
}
