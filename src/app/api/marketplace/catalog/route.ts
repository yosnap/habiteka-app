/**
 * Catálogo de productos para la paleta del marketplace. Lee el seed curado (sin
 * llamadas a feeds externos en el MVP) y permite filtrar por categorías para
 * sugerir según los elementos de un diseño.
 */
import { NextResponse } from 'next/server';
import { listCatalog } from '@/addons/marketplace/server/catalog-repo';

export async function GET(request: Request): Promise<Response> {
  const tagsParam = new URL(request.url).searchParams.get('tags');
  const tags = tagsParam ? tagsParam.split(',').filter(Boolean) : undefined;
  return NextResponse.json({ products: listCatalog(tags) });
}
