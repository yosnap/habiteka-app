/**
 * Errores de dominio del orquestador del agente.
 *
 * Distinguen las causas con sentido de negocio (un bloqueo legal no es lo mismo
 * que un conflicto de concurrencia) para que quien orquesta reaccione de forma
 * específica y la UI muestre un mensaje adecuado.
 */

export type AgentErrorKind =
  | 'phase_guard' // transición no permitida desde la fase actual
  | 'legal_block' // falta estilo o entregables: no se puede entregar
  | 'not_confirmed' // detección de ingesta no confirmada por el usuario
  | 'schema_repair_failed' // la salida estructurada no validó ni tras reparar
  | 'conflict'; // otro turno avanzó el estado (lock optimista)

export class AgentError extends Error {
  constructor(
    public readonly kind: AgentErrorKind,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AgentError';
  }
}

export function agentError(kind: AgentErrorKind, message: string, cause?: unknown): AgentError {
  return new AgentError(kind, message, cause);
}
