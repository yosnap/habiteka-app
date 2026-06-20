/**
 * Implementación mínima real del contrato de débito sobre el saldo de créditos.
 *
 * El agente programa contra la interfaz `DebitService` (F0); aquí se enlaza con
 * la máquina de estados de reservas ya existente, de modo que la entrega ejerce
 * comportamiento real (reserva/confirma/revierte con idempotencia) y no un stub.
 * El coste se convierte a una cantidad entera de créditos por una tarifa simple;
 * la facturación afinará la conversión más adelante.
 */
import type { DebitService, Hold, OperationCost } from '@/lib/contracts';
import {
  hold as holdCredits,
  settle as settleCredits,
  revert as revertCredits,
} from '@/server/billing/credit-hold';

// Conversión provisional coste→créditos: 1 crédito por cada 1000 tokens o por
// imagen. La tarifa definitiva la calibra la fase de facturación.
function costToCredits(cost: OperationCost): number {
  if (cost.kind === 'tokens') {
    return Math.max(1, Math.ceil((cost.usage.promptTokens + cost.usage.completionTokens) / 1000));
  }
  return Math.max(1, Math.ceil(cost.cost.amountUsd * 100));
}

export function createDebitService(organizationId: string): DebitService {
  return {
    async hold(idempotencyKey, estimate): Promise<Hold> {
      const credits = costToCredits(estimate);
      const created = await holdCredits({
        idempotencyKey,
        organizationId,
        amount: credits,
        refType: 'delivery',
        refId: idempotencyKey,
      });
      return { idempotencyKey: created.idempotencyKey, amount: created.amount };
    },
    async settle(h): Promise<void> {
      await settleCredits(h.idempotencyKey);
    },
    async revert(h): Promise<void> {
      await revertCredits(h.idempotencyKey);
    },
  };
}
