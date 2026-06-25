/**
 * Procesa los eventos de Polar ya verificados: sincroniza la suscripción y
 * acredita créditos al pagar un pedido. La idempotencia es la garantía clave:
 * cada evento se registra en `ProcessedWebhookEvent` (id único) DENTRO de la misma
 * transacción que la mutación de saldo, de modo que un reenvío del mismo evento no
 * vuelve a acreditar (el segundo intento choca con la restricción de unicidad).
 *
 * Esta función recibe un evento ya normalizado: la verificación de firma vive en
 * el route handler, así que aquí la lógica es testeable sin la red de Polar.
 */
import type { Prisma } from '@/generated/prisma/client';
import type { SubscriptionStatus } from '@/generated/prisma/enums';
import { prisma } from '@/server/db/prisma';
import { syncSubscription } from '../subscription-repo';

/** Evento normalizado de Polar que el procesador entiende. */
export type BillingEvent =
  | {
      kind: 'order_paid';
      eventId: string;
      organizationId: string;
      credits: number;
    }
  | {
      kind: 'subscription_changed';
      eventId: string;
      organizationId: string;
      plan: string;
      status: SubscriptionStatus;
      providerCustomerId?: string;
      providerSubscriptionId?: string;
    };

export interface ProcessResult {
  processed: boolean;
  duplicate: boolean;
}

/**
 * Aplica el efecto del evento de forma idempotente. Si el `eventId` ya se procesó,
 * no repite el efecto y lo señala como duplicado.
 */
export async function processBillingEvent(event: BillingEvent): Promise<ProcessResult> {
  if (await alreadyProcessed(event.eventId)) {
    return { processed: false, duplicate: true };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Registrar el evento PRIMERO en la misma tx: si ya existe, la unicidad
      // aborta la transacción y el efecto no se aplica dos veces.
      await tx.processedWebhookEvent.create({
        data: { eventId: event.eventId, type: event.kind },
      });

      if (event.kind === 'order_paid') {
        await applyCredits(tx, event.organizationId, event.credits, event.eventId);
      } else {
        await syncSubscription({
          organizationId: event.organizationId,
          plan: event.plan,
          status: event.status,
          providerCustomerId: event.providerCustomerId,
          providerSubscriptionId: event.providerSubscriptionId,
        });
      }
    });
    return { processed: true, duplicate: false };
  } catch (err) {
    // Carrera: otro proceso registró el mismo evento entre el chequeo y el insert.
    if (isUniqueViolation(err)) {
      return { processed: false, duplicate: true };
    }
    throw err;
  }
}

async function alreadyProcessed(eventId: string): Promise<boolean> {
  const row = await prisma.processedWebhookEvent.findUnique({ where: { eventId } });
  return row !== null;
}

// Acredita créditos al balance y deja constancia en el ledger, en la misma tx que
// el registro del evento (atomicidad: o todo o nada).
async function applyCredits(
  tx: Prisma.TransactionClient,
  organizationId: string,
  credits: number,
  eventId: string,
): Promise<void> {
  await tx.creditBalance.upsert({
    where: { organizationId },
    create: { organizationId, balance: credits },
    update: { balance: { increment: credits } },
  });
  await tx.creditLedger.create({
    data: { organizationId, delta: credits, reason: 'purchase', refId: eventId },
  });
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === 'P2002'
  );
}
