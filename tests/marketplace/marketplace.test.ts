import { describe, it, expect } from 'vitest';
import {
  isAllowedAffiliateUrl,
  assertAllowedAffiliateUrl,
  DisallowedAffiliateUrlError,
} from '@/addons/marketplace/server/affiliate-url';
import { listCatalog } from '@/addons/marketplace/server/catalog-repo';
import { findCatalogProduct } from '@/addons/marketplace/server/catalog-seed';
import {
  MARKETPLACE_ADDON,
  registerMarketplaceAddon,
} from '@/addons/marketplace/marketplace-addon';
import { createAddonRegistry } from '@/lib/addons/registry';
import { readProductDrop, DRAG_MIME } from '@/addons/marketplace/ui/use-product-drag';
import type { DragEvent } from 'react';

describe('affiliate-url (anti open-redirect)', () => {
  it('acepta dominios de afiliación permitidos (https)', () => {
    expect(isAllowedAffiliateUrl('https://www.amazon.es/dp/X?tag=habiteka-21')).toBe(true);
    expect(isAllowedAffiliateUrl('https://www.ikea.com/es/p/algo')).toBe(true);
    expect(isAllowedAffiliateUrl('https://amzn.to/abc')).toBe(true);
  });

  it('rechaza dominios no permitidos y http', () => {
    expect(isAllowedAffiliateUrl('https://malicioso.example/redir')).toBe(false);
    expect(isAllowedAffiliateUrl('http://www.amazon.es/dp/X')).toBe(false); // no https
    expect(isAllowedAffiliateUrl('https://amazon.es.attacker.com/x')).toBe(false); // sufijo falso
  });

  it('assert lanza para una URL no permitida', () => {
    expect(() => assertAllowedAffiliateUrl('https://evil.test')).toThrow(
      DisallowedAffiliateUrlError,
    );
  });
});

describe('catalog-repo (seed estático)', () => {
  it('devuelve el catálogo completo sin filtro', () => {
    expect(listCatalog().length).toBeGreaterThan(0);
  });

  it('filtra por categoría de elemento', () => {
    const suelo = listCatalog(['suelo']);
    expect(suelo.every((p) => p.tags.includes('suelo'))).toBe(true);
    expect(suelo.length).toBeGreaterThan(0);
  });

  it('todos los enlaces del seed están en la allowlist de afiliación', () => {
    for (const p of listCatalog()) {
      expect(isAllowedAffiliateUrl(p.affiliateUrl)).toBe(true);
    }
  });

  it('encuentra un producto por id', () => {
    const first = listCatalog()[0]!;
    expect(findCatalogProduct(first.id)?.id).toBe(first.id);
  });
});

describe('marketplace add-on', () => {
  it('se registra en los slots correctos', () => {
    const registry = registerMarketplaceAddon(createAddonRegistry());
    expect(registry.get('marketplace')).toEqual(MARKETPLACE_ADDON);
    expect(MARKETPLACE_ADDON.slots).toContain('canvas.toolbar');
  });
});

describe('use-product-drag (emite ProductDrop de F0)', () => {
  function fakeDragEvent(data: Record<string, string>): DragEvent {
    return {
      dataTransfer: { getData: (mime: string) => data[mime] ?? '' },
    } as unknown as DragEvent;
  }

  it('materializa un ProductDrop con la posición del stage', () => {
    const event = fakeDragEvent({
      [DRAG_MIME]: JSON.stringify({ marketplaceItemId: 'ikea-puerta-1' }),
    });
    const drop = readProductDrop(event, 120, 80);
    expect(drop).toEqual({ marketplaceItemId: 'ikea-puerta-1', stageX: 120, stageY: 80 });
  });

  it('devuelve null si el evento no trae payload de producto', () => {
    expect(readProductDrop(fakeDragEvent({}), 0, 0)).toBeNull();
  });
});
