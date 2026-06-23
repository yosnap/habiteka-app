import { describe, it, expect } from 'vitest';
import { searchFullCatalog, normalize } from '@/canvas/catalog-search';

const allKinds = (cats: ReturnType<typeof searchFullCatalog>) =>
  cats.flatMap((c) => c.items.map((i) => i.kind));

describe('normalize', () => {
  it('quita acentos y pasa a minúsculas', () => {
    expect(normalize('Lámpara')).toBe('lampara');
    expect(normalize('  SOFÁ ')).toBe('sofa');
    expect(normalize('Estantería')).toBe('estanteria');
  });
});

describe('searchFullCatalog', () => {
  it('texto vacío devuelve todo el catálogo', () => {
    const r = searchFullCatalog('');
    expect(r.length).toBeGreaterThan(0);
    expect(allKinds(r)).toContain('sofa');
  });

  it('casa por nombre del objeto, insensible a acentos', () => {
    expect(allKinds(searchFullCatalog('sofa'))).toEqual(['sofa']);
    expect(allKinds(searchFullCatalog('lampara'))).toContain('lampara');
    expect(allKinds(searchFullCatalog('lámpara'))).toContain('lampara');
  });

  it('casa por sinónimo coloquial', () => {
    expect(allKinds(searchFullCatalog('wc'))).toContain('inodoro');
    expect(allKinds(searchFullCatalog('frigo'))).toContain('nevera');
    expect(allKinds(searchFullCatalog('tele'))).toContain('tv');
    expect(allKinds(searchFullCatalog('váter'))).toContain('inodoro');
  });

  it('casa por nombre de categoría (muestra todos sus items)', () => {
    const r = searchFullCatalog('cocina');
    const kinds = allKinds(r);
    // "Cocina" es categoría → trae fregadero, nevera, horno, isla, encimera…
    expect(kinds).toContain('nevera');
    expect(kinds).toContain('horno');
  });

  it('sin coincidencias devuelve lista vacía', () => {
    expect(searchFullCatalog('zxqw')).toEqual([]);
  });

  it('no incluye categorías sin items tras filtrar', () => {
    const r = searchFullCatalog('cama');
    expect(r.every((c) => c.items.length > 0)).toBe(true);
    expect(allKinds(r)).toContain('cama');
  });
});
