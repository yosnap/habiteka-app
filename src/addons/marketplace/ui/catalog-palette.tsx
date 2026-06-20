'use client';

/**
 * Paleta de productos del marketplace (se monta en la barra del canvas). Carga el
 * catálogo al montar y muestra las tarjetas arrastrables junto a la divulgación de
 * afiliación obligatoria.
 */
import { useState } from 'react';
import { useMountEffect } from '@/lib/use-mount-effect';
import { ProductCard } from './product-card';
import { AffiliateDisclosure } from './affiliate-disclosure';
import type { CatalogProduct } from '../server/catalog-seed';

export function CatalogPalette() {
  const [products, setProducts] = useState<CatalogProduct[]>([]);

  useMountEffect(() => {
    let active = true;
    void fetch('/api/marketplace/catalog')
      .then((r) => r.json())
      .then((data: { products: CatalogProduct[] }) => {
        if (active) setProducts(data.products);
      });
    return () => {
      active = false;
    };
  });

  return (
    <div className="flex flex-col gap-2">
      <AffiliateDisclosure />
      <div className="flex flex-wrap gap-2">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  );
}
