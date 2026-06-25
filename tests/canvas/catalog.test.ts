import { describe, it, expect } from 'vitest';
import { CATALOG, CATALOG_BY_KIND } from '@/canvas/catalog';
import type { StructKind } from '@/canvas/types';

// Fuente única de los kinds esperados: este Record obliga al COMPILADOR a listar
// cada `StructKind` (si se añade uno al tipo y se olvida aquí, falla el typecheck).
// El test comprueba que el catálogo cubre exactamente esos kinds. Así "añadir un
// elemento" queda blindado: type + catálogo deben ir de la mano.
const EXPECTED_KINDS: Record<StructKind, true> = {
  // estructura
  wall: true,
  window: true,
  door: true,
  // sanitarios
  inodoro: true,
  lavabo: true,
  ducha: true,
  banera: true,
  bidet: true,
  // cocina
  fregadero: true,
  encimera: true,
  nevera: true,
  nevera_americana: true,
  nevera_mini: true,
  horno: true,
  isla: true,
  vitroceramica: true,
  microondas: true,
  // mobiliario
  cama: true,
  sofa: true,
  sofa_grande: true,
  butaca: true,
  mesa: true,
  silla: true,
  armario: true,
  estanteria: true,
  mesilla: true,
  // electrónica
  tv: true,
  ordenador: true,
  lampara: true,
  // decoración
  alfombra: true,
  planta: true,
  chimenea: true,
  // iluminación
  foco: true,
  ceiling_light: true,
  pendant_lamp: true,
};

const expectedKinds = Object.keys(EXPECTED_KINDS).sort();
const catalogKinds = CATALOG.flatMap((c) => c.items.map((i) => i.kind)).sort();

describe('catálogo extensible', () => {
  it('cubre exactamente los kinds del tipo (completo y sin huérfanos)', () => {
    // Completo: todo StructKind tiene entrada. Sin huérfanos: ninguna entrada
    // sobra. La igualdad de conjuntos garantiza el principio de escalabilidad.
    expect(catalogKinds).toEqual(expectedKinds);
  });

  it('no tiene kinds duplicados en el catálogo', () => {
    expect(new Set(catalogKinds).size).toBe(catalogKinds.length);
  });

  it('cada entrada tiene label y tamaños por defecto positivos', () => {
    for (const cat of CATALOG) {
      for (const item of cat.items) {
        expect(item.label.length).toBeGreaterThan(0);
        expect(item.defaultWidth).toBeGreaterThan(0);
        expect(item.defaultHeight).toBeGreaterThan(0);
      }
    }
  });

  it('CATALOG_BY_KIND indexa cada kind del catálogo', () => {
    for (const kind of catalogKinds) {
      expect(CATALOG_BY_KIND[kind]?.kind).toBe(kind);
    }
  });

  it('incluye los nuevos elementos de decoración', () => {
    expect(CATALOG_BY_KIND['alfombra']?.label).toBe('Alfombra');
    expect(CATALOG_BY_KIND['planta']?.label).toBe('Planta');
    expect(CATALOG_BY_KIND['chimenea']?.label).toBe('Chimenea');
  });
});
