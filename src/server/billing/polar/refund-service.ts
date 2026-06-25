/**
 * Reembolso de un pedido vía la API de Polar. La lógica de pago vive en la capa de
 * facturación (no en el back-office): el panel solo la invoca. Devuelve si el
 * reembolso se aceptó, para que el llamador lo audite.
 */
import type { RefundReason } from '@polar-sh/sdk/models/components/refundreason.js';
import { getPolarClient } from './polar-client';

export interface RefundInput {
  orderId: string;
  /** Importe a reembolsar en la unidad menor (céntimos). */
  amount: number;
  reason?: RefundReason;
}

export async function refundOrder(input: RefundInput): Promise<{ ok: boolean }> {
  await getPolarClient().refunds.create({
    orderId: input.orderId,
    amount: input.amount,
    reason: input.reason ?? 'customer_request',
    revokeBenefits: true,
  });
  return { ok: true };
}
