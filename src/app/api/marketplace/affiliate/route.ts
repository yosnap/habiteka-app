/**
 * Redirección de afiliación: registra el clic y redirige al producto. La URL de
 * destino sale del catálogo del servidor (nunca del cliente) y se valida contra la
 * allowlist de dominios para evitar un open-redirect. El fallo del registro no
 * impide la redirección.
 */
import { NextResponse } from 'next/server';
import { findCatalogProduct } from '@/addons/marketplace/server/catalog-seed';
import {
  assertAllowedAffiliateUrl,
  DisallowedAffiliateUrlError,
} from '@/addons/marketplace/server/affiliate-url';
import { trackAffiliateClick } from '@/addons/marketplace/server/affiliate-tracking';

export async function GET(request: Request): Promise<Response> {
  const itemId = new URL(request.url).searchParams.get('itemId');
  if (!itemId) {
    return NextResponse.json({ error: 'itemId requerido' }, { status: 400 });
  }
  const product = findCatalogProduct(itemId);
  if (!product) {
    return NextResponse.json({ error: 'producto no encontrado' }, { status: 404 });
  }

  let target: string;
  try {
    // La URL viene del catálogo del servidor; aun así se valida la allowlist.
    target = assertAllowedAffiliateUrl(product.affiliateUrl);
  } catch (err) {
    if (err instanceof DisallowedAffiliateUrlError) {
      return NextResponse.json({ error: 'destino no permitido' }, { status: 422 });
    }
    throw err;
  }

  await trackAffiliateClick({ itemId });
  return NextResponse.redirect(target, 302);
}
