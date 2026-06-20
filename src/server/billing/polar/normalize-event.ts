/**
 * Traduce un evento crudo de Polar al evento normalizado que entiende el
 * procesador. Aísla la forma del payload del proveedor (que puede cambiar) de la
 * lógica de negocio: si Polar reestructura su payload, solo se ajusta aquí.
 *
 * El `organizationId` de Habiteka viaja en los metadatos del checkout/suscripción
 * (se fija al crear el checkout), de modo que el webhook sabe a qué organización
 * acreditar sin depender del mapeo de clientes de Polar.
 */
import type { BillingEvent } from './webhook-handlers';
import type { SubscriptionStatus } from '@/generated/prisma/enums';

interface RawPolarEvent {
  type: string;
  data: {
    id?: string;
    metadata?: Record<string, unknown>;
    product_id?: string;
    status?: string;
    customer_id?: string;
  };
}

const STATUS_MAP: Record<string, SubscriptionStatus> = {
  active: 'ACTIVE',
  trialing: 'TRIALING',
  past_due: 'PAST_DUE',
  canceled: 'CANCELED',
  incomplete: 'INCOMPLETE',
};

export interface NormalizeContext {
  /** Id único del evento (de la cabecera Standard Webhooks `webhook-id`). */
  eventId: string;
  /** Créditos que otorga el paquete comprado (de la configuración). */
  creditsPerPack: number;
}

/** Normaliza el evento; devuelve `null` para tipos que no nos interesan. */
export function normalizeEvent(raw: RawPolarEvent, ctx: NormalizeContext): BillingEvent | null {
  const organizationId = readOrganizationId(raw.data.metadata);
  if (!organizationId) return null;

  if (raw.type === 'order.paid') {
    return {
      kind: 'order_paid',
      eventId: ctx.eventId,
      organizationId,
      credits: ctx.creditsPerPack,
    };
  }

  if (raw.type.startsWith('subscription.')) {
    const status = STATUS_MAP[raw.data.status ?? ''] ?? 'INCOMPLETE';
    return {
      kind: 'subscription_changed',
      eventId: ctx.eventId,
      organizationId,
      plan: readPlan(raw.data.metadata),
      status,
      providerCustomerId: raw.data.customer_id,
      providerSubscriptionId: raw.data.id,
    };
  }

  return null;
}

function readOrganizationId(metadata: Record<string, unknown> | undefined): string | null {
  const value = metadata?.organizationId;
  return typeof value === 'string' ? value : null;
}

function readPlan(metadata: Record<string, unknown> | undefined): string {
  const value = metadata?.plan;
  return typeof value === 'string' ? value : 'pro';
}
