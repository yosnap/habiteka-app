/**
 * Emisión de telemetría de uso de IA.
 *
 * Es el único punto de escritura de `UsageEvent`: la capa de IA y la de
 * facturación lo invocan al medir el coste de una operación. La telemetría va
 * SEPARADA del ledger contable (créditos) a propósito —miden cosas distintas— y
 * la tabla es append-only. La analítica del back-office solo agrega/lee esto.
 */
import type { UsageUnit } from '@/generated/prisma/enums';
import { prisma } from '@/server/db/prisma';

export interface UsageEventInput {
  userId?: string;
  organizationId?: string;
  action: string;
  unit: UsageUnit;
  amount: number;
  /** Coste monetario estimado/medido de la operación, en USD. */
  costUsd: number;
  refId?: string;
}

/** Registra un evento de uso. No falla la operación de negocio si esto falla. */
export async function emitUsageEvent(input: UsageEventInput): Promise<void> {
  await prisma.usageEvent.create({
    data: {
      userId: input.userId,
      orgId: input.organizationId,
      action: input.action,
      unit: input.unit,
      amount: input.amount,
      cost: input.costUsd.toFixed(6),
      refId: input.refId,
    },
  });
}
