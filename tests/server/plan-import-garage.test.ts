/**
 * Puerta de garaje al importar: un hueco ancho (2,2 m o más) en la fachada de una estancia rotulada garaje, cochera o
 * parking entra como puerta de garaje seccional, también cuando la lectura solo vio un hueco. Bocetos sintéticos, sin IA.
 */
import { describe, expect, it } from 'vitest';
import type { RawSketch } from '@/server/ai/sketch/sketch-types';
import { buildPlanImport } from '@/server/plan/build-plan-import';
import { markGarageDoors } from '@/server/ai/sketch/garage-apertures';
import { emptyEditorDocument, type EditorDocument, type Opening } from '@/lib/editor-document/schema';
import { importedOpeningTypes } from '@/lib/editor-document/imported-opening-types';
import { apertureCatalogId, apertureWidthLimits, leafWithoutArc, parseApertureVariant, recognizedLeafType } from '@/server/ai/sketch/aperture-types';

const sq = (x0: number, y0: number, x1: number, y1: number) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];

/** Vivienda de 8 × 4 m: salón a la izquierda y la COCHERA (con su coche dibujado) a la derecha; 10 m por unidad. */
function sketch(aberturas: RawSketch['aberturas'], garageName = 'COCHERA'): RawSketch {
  return {
    anchoMetros: 8, escalaFiable: true,
    muros: [
      { x1: 0.1, y1: 0.1, x2: 0.9, y2: 0.1 }, { x1: 0.9, y1: 0.1, x2: 0.9, y2: 0.5 },
      { x1: 0.9, y1: 0.5, x2: 0.5, y2: 0.5 }, { x1: 0.5, y1: 0.5, x2: 0.1, y2: 0.5 },
      { x1: 0.1, y1: 0.5, x2: 0.1, y2: 0.1 }, { x1: 0.5, y1: 0.1, x2: 0.5, y2: 0.5 },
    ],
    habitaciones: [{ nombre: 'Salón', poligono: sq(0.1, 0.1, 0.5, 0.5) },
      // La visión suele marcar la cochera como exterior aunque esté cerrada.
      { nombre: garageName, poligono: sq(0.5, 0.1, 0.9, 0.5), exterior: true }],
    aberturas,
  };
}
const options = (raw: RawSketch) => ({ normalize: { wallsOverride: raw.muros.map((wall) => ({ ...wall, thickness: 0.02 })), imageHeightOverWidth: 1 } });
const apertures = (raw: RawSketch) => buildPlanImport(raw, options(raw)).plano.zones.flatMap((zone) => zone.apertures);
const SCALE = { mmPerUnitX: 10_000, mmPerUnitY: 10_000 };

describe('puerta de garaje en el boceto', () => {
  it('el hueco ancho en la fachada de la cochera entra como seccional con su ancho', () => {
    const raw = sketch([{ tipo: 'hueco', muro: 2, posicion: 0.5, anchoSobreMuro: 0.65 }]);
    const garage = apertures(raw).find((aperture) => aperture.catalogId === 'puerta-garaje');
    expect(garage).toBeDefined();
    expect(garage!.widthMm).toBeGreaterThanOrEqual(2200);
  });

  it('no lo hace con un paso estrecho, en otra estancia, entre el salón y la cochera o si la lectura ya distinguió el tipo', () => {
    expect(markGarageDoors(sketch([{ tipo: 'hueco', muro: 2, posicion: 0.5, anchoSobreMuro: 0.3 }]), SCALE).aberturas[0]!.variante).toBeUndefined();
    expect(markGarageDoors(sketch([{ tipo: 'hueco', muro: 3, posicion: 0.5, anchoSobreMuro: 0.65 }]), SCALE).aberturas[0]!.variante).toBeUndefined();
    expect(markGarageDoors(sketch([{ tipo: 'hueco', muro: 5, posicion: 0.5, anchoSobreMuro: 0.65 }]), SCALE).aberturas[0]!.variante).toBeUndefined();
    expect(markGarageDoors(sketch([{ tipo: 'puerta', muro: 2, posicion: 0.5, anchoSobreMuro: 0.65, variante: 'doble' }]), SCALE)
      .aberturas[0]!.variante).toBe('doble');
    // Sin cochera no se toca nada; «Parking» y «Garaje 2» también cuentan.
    const plain = sketch([{ tipo: 'hueco', muro: 2, posicion: 0.5, anchoSobreMuro: 0.65 }], 'Taller');
    expect(markGarageDoors(plain, SCALE)).toBe(plain);
    expect(markGarageDoors(sketch([{ tipo: 'hueco', muro: 2, posicion: 0.5, anchoSobreMuro: 0.65 }], 'Parking'), SCALE).aberturas[0])
      .toMatchObject({ tipo: 'puerta', variante: 'garaje' });
    expect(markGarageDoors(sketch([{ tipo: 'hueco', muro: 2, posicion: 0.5, anchoSobreMuro: 0.65 }], 'Garaje 2'), SCALE).aberturas[0]!.variante)
      .toBe('garaje');
  });

  it('las variantes nuevas se leen solo en puertas y llevan a su tipo con anchos reales', () => {
    expect(parseApertureVariant('puerta', 'granero')).toBe('granero');
    expect(parseApertureVariant('ventana', 'garaje')).toBeUndefined();
    expect(apertureCatalogId('puerta', 'granero', 1000)).toBe('puerta-granero');
    expect(apertureCatalogId('puerta', 'corredera-central', 1600)).toBe('puerta-corredera-central');
    expect(apertureCatalogId('puerta', 'garaje', 2500)).toBe('puerta-garaje');
    expect(apertureCatalogId('puerta', 'corredera', 3200)).toBe('puerta-corredera-elevadora');
    expect(apertureWidthLimits('puerta', 'garaje')).toEqual({ defaultMm: 2500, maxMm: 5000 });
    expect(['granero', 'corredera-central', 'garaje'].every((variant) => leafWithoutArc(variant as 'garaje'))).toBe(true);
    expect(recognizedLeafType('puerta-garaje')).toBe(true);
    expect(recognizedLeafType('puerta-entrada-hoja-media')).toBe(false);
  });
});

describe('puerta de garaje en el documento importado', () => {
  /** Dos estancias de 3 × 4 m; la de la derecha, rotulada como cochera, con un hueco en su fachada sur. */
  function house(label: string, widthMm: number, kind: Opening['kind'] = 'hueco'): EditorDocument {
    const doc = emptyEditorDocument();
    doc.vertices = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 3000, y: 0 }, { id: 'c', x: 6000, y: 0 },
      { id: 'd', x: 6000, y: 4000 }, { id: 'e', x: 3000, y: 4000 }, { id: 'f', x: 0, y: 4000 }];
    doc.walls = [['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'e'], ['e', 'f'], ['f', 'a'], ['b', 'e']].map(([a, b], i) => ({
      id: `w${i}`, startVertexId: a!, endVertexId: b!, thicknessMm: 150, dimensionalOrigin: 'physical' as const }));
    doc.labels = [{ id: 'l1', x: 1500, y: 2000, text: 'Salón' }, { id: 'l2', x: 4500, y: 2000, text: label }];
    const opening: Opening = { id: 'gap', wallId: 'w1', kind, position: .5, widthMm, dimensionalOrigin: 'physical' };
    doc.openings = [opening];
    return doc;
  }

  it('el hueco de 2,2 m o más en la fachada de la cochera pasa a puerta de garaje seccional', () => {
    expect(importedOpeningTypes(house('COCHERA', 2500), new Map()).get('gap')?.id).toBe('puerta-garaje');
    expect(importedOpeningTypes(house('Garaje', 2200), new Map()).get('gap')?.id).toBe('puerta-garaje');
    expect(importedOpeningTypes(house('COCHERA', 1800), new Map()).get('gap')).toBeUndefined();
    expect(importedOpeningTypes(house('Dormitorio', 2500), new Map()).get('gap')).toBeUndefined();
    // Si la lectura distinguió otro tipo (una corredera lateral, por ejemplo), manda la lectura.
    expect(importedOpeningTypes(house('COCHERA', 2500, 'puerta'), new Map([['gap', 'puerta-garaje-corredera']])).get('gap')?.id)
      .toBe('puerta-garaje-corredera');
    expect(importedOpeningTypes(house('COCHERA', 2500, 'puerta'), new Map()).get('gap')?.id).toBe('puerta-garaje');
  });
});
