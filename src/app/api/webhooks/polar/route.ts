/**
 * Endpoint de webhooks de Polar.
 *
 * Verifica la firma sobre el cuerpo CRUDO (sin parseo previo) antes de confiar en
 * nada del payload; una firma inválida se rechaza sin tocar el estado. El evento
 * verificado se normaliza y se procesa de forma idempotente (un reenvío no
 * re-acredita). Los secretos de Polar no salen del servidor.
 */
import { validateEvent, WebhookVerificationError } from '@polar-sh/sdk/webhooks';
import { normalizeEvent } from '@/server/billing/polar/normalize-event';
import { processBillingEvent } from '@/server/billing/polar/webhook-handlers';

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.POLAR_WEBHOOK_SECRET;
  if (!secret) {
    return new Response('webhook secret no configurado', { status: 500 });
  }

  const rawBody = await request.text();
  const headers = Object.fromEntries(request.headers.entries());

  let event: ReturnType<typeof validateEvent>;
  try {
    event = validateEvent(rawBody, headers, secret);
  } catch (err) {
    if (err instanceof WebhookVerificationError) {
      return new Response('firma inválida', { status: 403 });
    }
    throw err;
  }

  // El id único del evento viene en la cabecera Standard Webhooks `webhook-id`.
  const eventId = headers['webhook-id'] ?? '';
  const creditsPerPack = Number(process.env.POLAR_CREDITS_PER_PACK ?? '500');

  const normalized = normalizeEvent(event as never, { eventId, creditsPerPack });
  if (!normalized) {
    // Evento que no nos concierne: se acepta sin efecto (Polar no lo reintenta).
    return new Response('', { status: 202 });
  }

  await processBillingEvent(normalized);
  return new Response('', { status: 202 });
}
