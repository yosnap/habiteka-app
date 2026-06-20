/**
 * Catálogo curado de productos (seed estático en código).
 *
 * En el MVP no hay integración con feeds reales (PA-API de Amazon, feeds de Ikea
 * son inestables/restringidos): el catálogo es esta lista curada. La sincronización
 * automática queda para más adelante y reemplazaría esta fuente sin tocar la UI ni
 * el tracking. Cada enlace de afiliación apunta a un dominio permitido.
 */
export interface CatalogProduct {
  id: string;
  label: string;
  vendor: string;
  imageUrl: string;
  /** Precio orientativo (texto), solo informativo. */
  priceLabel: string;
  affiliateUrl: string;
  /** Categorías para filtrar por elementos del diseño (puerta, suelo, …). */
  tags: string[];
}

export const CATALOG: CatalogProduct[] = [
  {
    id: 'ikea-puerta-1',
    label: 'Puerta corredera BILLY',
    vendor: 'Ikea',
    imageUrl: 'https://www.ikea.com/img/billy.jpg',
    priceLabel: '129 €',
    affiliateUrl: 'https://www.ikea.com/es/es/p/billy/',
    tags: ['puerta'],
  },
  {
    id: 'amazon-suelo-1',
    label: 'Suelo laminado roble',
    vendor: 'Amazon',
    imageUrl: 'https://m.media-amazon.com/images/roble.jpg',
    priceLabel: '24 €/m²',
    affiliateUrl: 'https://www.amazon.es/dp/B000SUELO?tag=habiteka-21',
    tags: ['suelo'],
  },
  {
    id: 'amazon-lampara-1',
    label: 'Lámpara de techo nórdica',
    vendor: 'Amazon',
    imageUrl: 'https://m.media-amazon.com/images/lampara.jpg',
    priceLabel: '49 €',
    affiliateUrl: 'https://www.amazon.es/dp/B000LAMP?tag=habiteka-21',
    tags: ['iluminacion'],
  },
];

/** Busca un producto del catálogo por id. */
export function findCatalogProduct(id: string): CatalogProduct | undefined {
  return CATALOG.find((p) => p.id === id);
}
