/**
 * Crea sesiones de checkout en Polar. Se adjunta el `organizationId` de Habiteka
 * en los metadatos para que el webhook posterior sepa a qué organización acreditar
 * sin depender del mapeo de clientes de Polar. Server-only.
 */
import { getPolarClient } from './polar-client';

export interface CheckoutInput {
  organizationId: string;
  productId: string;
  /** Plan asociado (para suscripciones); los webhooks lo leen del metadato. */
  plan?: string;
  customerEmail?: string;
}

/** Crea un checkout y devuelve su URL para redirigir al usuario. */
export async function createCheckout(input: CheckoutInput): Promise<{ url: string }> {
  const successUrl = process.env.BILLING_SUCCESS_URL ?? 'https://habiteka.app/billing/success';
  const checkout = await getPolarClient().checkouts.create({
    products: [input.productId],
    successUrl,
    customerEmail: input.customerEmail,
    metadata: {
      organizationId: input.organizationId,
      ...(input.plan ? { plan: input.plan } : {}),
    },
  });
  return { url: checkout.url };
}
