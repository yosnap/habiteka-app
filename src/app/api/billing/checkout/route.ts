/**
 * Endpoint de checkout: inicia el pago de un paquete de créditos o un plan. Exige
 * sesión y resuelve la organización, de modo que cada usuario solo inicia el
 * checkout de su propia organización. Devuelve la URL de Polar a la que redirigir.
 */
import { NextResponse } from 'next/server';
import { requireOrgContext } from '@/server/auth/require-org-context';
import { createCheckout } from '@/server/billing/polar/checkout-service';

export async function POST(request: Request): Promise<Response> {
  const ctx = await requireOrgContext();
  const body = (await request.json()) as { productId?: string; plan?: string };

  const productId = body.productId ?? process.env.POLAR_CREDITS_PRODUCT_ID;
  if (!productId) {
    return NextResponse.json({ error: 'producto no especificado' }, { status: 400 });
  }

  const { url } = await createCheckout({
    organizationId: ctx.organizationId,
    productId,
    plan: body.plan,
  });
  return NextResponse.json({ url });
}
