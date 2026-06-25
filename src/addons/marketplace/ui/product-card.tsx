'use client';

/**
 * Tarjeta de un producto del catálogo: arrastrable hacia el canvas y con enlace de
 * afiliación que pasa por el endpoint de redirección (que registra el clic y valida
 * el destino). La imagen es de un proveedor conocido del catálogo curado.
 */
import { onProductDragStart } from './use-product-drag';
import type { CatalogProduct } from '../server/catalog-seed';

export function ProductCard({ product }: { product: CatalogProduct }) {
  return (
    <article
      draggable
      onDragStart={(e) => onProductDragStart(e, product.id)}
      className="border-line flex w-40 cursor-grab flex-col gap-1 rounded-card border p-2"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={product.imageUrl} alt="" className="aspect-square w-full rounded object-cover" />
      <span className="text-sm font-medium">{product.label}</span>
      <span className="text-muted-foreground text-xs">
        {product.vendor} · {product.priceLabel}
      </span>
      <a
        href={`/api/marketplace/affiliate?itemId=${product.id}`}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="text-brand-700 text-xs hover:underline"
      >
        Ver en {product.vendor}
      </a>
    </article>
  );
}
