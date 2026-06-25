/**
 * Servicio de débito de créditos (hold / settle / revert).
 *
 * Contrato congelado pronto porque el agente (entrega) y el feedback lo
 * consumen antes de que exista la implementación real: primero contra un stub
 * que satisface la interfaz, luego contra el ledger real con bloqueo de fila.
 *
 * Patrón de dos fases: se reserva un `hold` por una estimación, y al conocer el
 * coste real se confirma (`settle`) o se anula (`revert`). La idempotencia
 * (clave derivada de `deliverableId + version`) evita doble cobro ante
 * reintentos.
 */
import type { ProviderCost, TokenUsage } from './credits';

/** Coste de una operación de IA, en las unidades neutrales del proveedor. */
export type OperationCost =
  | { kind: 'tokens'; usage: TokenUsage }
  | { kind: 'provider'; cost: ProviderCost };

export interface Hold {
  /** Clave idempotente derivada de `deliverableId + version`. */
  idempotencyKey: string;
  /** Créditos reservados por la estimación. */
  amount: number;
}

export interface DebitService {
  /** Reserva créditos por una estimación. Idempotente por `idempotencyKey`. */
  hold(idempotencyKey: string, estimate: OperationCost): Promise<Hold>;
  /** Confirma el cobro ajustando al coste real medido. */
  settle(hold: Hold, actualCost: OperationCost): Promise<void>;
  /** Libera la reserva sin cobrar (operación fallida o dentro del cupo gratis). */
  revert(hold: Hold): Promise<void>;
}
