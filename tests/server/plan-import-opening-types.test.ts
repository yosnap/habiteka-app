/**
 * La lectura del plano distingue el tipo de carpintería cuando el símbolo lo muestra (entrada, doble hoja, corredera,
 * plegable, balconera, ventana corredera) y la importación lo lleva como `catalogId` con un ancho razonable. Lo que no
 * se distingue queda básico. Extracciones sintéticas, sin IA.
 */
import { describe, expect, it } from 'vitest';
import type { RawSketch } from '@/server/ai/sketch/sketch-types';
import { parseRawSketch, SKETCH_SCHEMA } from '@/server/ai/sketch/extract-sketch-geometry';
import { apertureCatalogId, APERTURE_VARIANTS, apertureWidthLimits } from '@/server/ai/sketch/aperture-types';
import { anchorApertures, seedsFromGaps } from '@/server/ai/sketch/normalize-geometry';
import { mergePlanSymbols } from '@/server/ai/sketch/extract-plan-symbols';
import { buildPlanImport } from '@/server/plan/build-plan-import';
import { OPENING_TYPES } from '@/lib/editor-document/opening-types';

const wall = { x1: 0, y1: 0, x2: 1, y2: 0 };

describe('variante de carpintería en la lectura', () => {
  it('la pide en el esquema y solo acepta la que corresponde a cada clase', () => {
    const items = (SKETCH_SCHEMA.properties as Record<string, { items: { properties: Record<string, unknown> } }>).aberturas!.items;
    expect(items.properties.variante).toMatchObject({ enum: [...APERTURE_VARIANTS] });
    const raw = parseRawSketch({ muros: [wall], habitaciones: [], aberturas: [
      { tipo: 'puerta', muro: 0, posicion: 0.2, variante: 'corredera' },
      { tipo: 'puerta', muro: 0, posicion: 0.4, variante: 'balconera' },
      { tipo: 'ventana', muro: 0, posicion: 0.6, variante: 'balconera' },
      { tipo: 'ventana', muro: 0, posicion: 0.7, variante: 'entrada' },
      { tipo: 'hueco', muro: 0, posicion: 0.8, variante: 'corredera' },
      { tipo: 'puerta', muro: 0, posicion: 0.9, variante: 'blindada' },
    ] });
    expect(raw.aberturas.map((item) => item.variante)).toEqual(['corredera', undefined, 'balconera', undefined, undefined, undefined]);
  });

  it('en una puerta de dos hojas no usa los tres puntos de una sola hoja', () => {
    const arcGeometry = { hinge: { x: 0.4, y: 0 }, openingEnd: { x: 0.5, y: 0 }, arcPoint: { x: 0.4, y: 0.1 } };
    const raw = parseRawSketch({ muros: [wall], habitaciones: [], aberturas: [
      { tipo: 'puerta', muro: 0, posicion: 0.5, anchoSobreMuro: 0.2, arcVisible: true, arcGeometry, variante: 'doble' },
      { tipo: 'puerta', muro: 0, posicion: 0.2, arcVisible: true, arcGeometry, variante: 'entrada' },
    ] });
    expect(raw.aberturas[0]).not.toHaveProperty('arcGeometry');
    expect(raw.aberturas[1]).toHaveProperty('arcGeometry');
  });

  it('cada variante corresponde a un tipo del catálogo del editor de su clase', () => {
    const ids = new Map(OPENING_TYPES.map((type) => [type.id, type.kind]));
    for (const variante of APERTURE_VARIANTS) for (const kind of ['puerta', 'ventana'] as const) {
      for (const widthMm of [900, 1800]) {
        const id = apertureCatalogId(kind, variante, widthMm);
        if (id) expect(ids.get(id)).toBe(kind);
      }
    }
    expect(apertureCatalogId('puerta', 'corredera', 1200)).toBe('puerta-corredera');
    expect(apertureCatalogId('puerta', 'corredera', 1400)).toBe('puerta-corredera-vidrio');
    expect(apertureCatalogId('hueco', 'corredera', 1800)).toBeUndefined();
    expect(apertureCatalogId('puerta', undefined, 900)).toBeUndefined();
    // Sin variante, los anchos de siempre; una corredera puede ser mucho más ancha que una abatible.
    expect(apertureWidthLimits('puerta')).toEqual({ defaultMm: 900, maxMm: 1100 });
    expect(apertureWidthLimits('puerta', 'corredera').maxMm).toBe(4000);
    expect(apertureWidthLimits('ventana', 'corredera')).toEqual({ defaultMm: 1200, maxMm: 2600 });
  });
});

describe('tipo de carpintería en el plano importado', () => {
  // Casa de 6 × 4 m con un tabique en x = 0.4 y una terraza debajo (y 0.5–0.7). Escala fiable: 10 m por unidad.
  function raw(aberturas: RawSketch['aberturas']): RawSketch {
    const sq = (x0: number, y0: number, x1: number, y1: number) => [
      { x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 },
    ];
    return {
      anchoMetros: 6, altoMetros: 4, escalaFiable: true,
      muros: [
        { x1: 0.1, y1: 0.1, x2: 0.7, y2: 0.1 },
        { x1: 0.1, y1: 0.5, x2: 0.7, y2: 0.5 },
        { x1: 0.1, y1: 0.1, x2: 0.1, y2: 0.5 },
        { x1: 0.4, y1: 0.1, x2: 0.4, y2: 0.5 },
        { x1: 0.7, y1: 0.1, x2: 0.7, y2: 0.5 },
      ],
      aberturas,
      habitaciones: [
        { nombre: 'Dormitorio', poligono: sq(0.1, 0.1, 0.4, 0.5) },
        { nombre: 'Salón', poligono: sq(0.4, 0.1, 0.7, 0.5) },
        { nombre: 'Terraza', poligono: sq(0.1, 0.5, 0.7, 0.7), exterior: true },
      ],
    };
  }
  const apertures = (source: RawSketch) => buildPlanImport(source).plano.zones.flatMap((zone) => zone.apertures)
    .sort((a, b) => a.wallId.localeCompare(b.wallId) || a.position - b.position);

  it('lleva la corredera ancha a la terraza, la doble hoja y la balconera con su tipo y su ancho', () => {
    const read = apertures(raw([
      // Salida acristalada de 1,8 m del salón a la terraza.
      { tipo: 'puerta', muro: 1, posicion: 0.75, anchoSobreMuro: 0.3, variante: 'corredera' },
      // Doble hoja de 1,4 m en el tabique.
      { tipo: 'puerta', muro: 3, posicion: 0.5, anchoSobreMuro: 0.35, variante: 'doble' },
      // Balconera del dormitorio a la terraza y una puerta sin marca en la fachada.
      { tipo: 'ventana', muro: 1, posicion: 0.25, anchoSobreMuro: 0.2, variante: 'balconera' },
      { tipo: 'puerta', muro: 0, posicion: 0.75, anchoSobreMuro: 0.15, arcVisible: true },
    ]));
    const byType = (catalogId: string | undefined) => read.find((aperture) => aperture.catalogId === catalogId);
    expect(byType('puerta-corredera-vidrio')).toMatchObject({ kind: 'puerta', widthMm: 1800 });
    expect(byType('puerta-doble')).toMatchObject({ kind: 'puerta', widthMm: 1400 });
    expect(byType('ventana-balconera')).toMatchObject({ kind: 'ventana', widthMm: 1200 });
    // Sin variante, básica: sin tipo y con el ancho acotado de siempre.
    expect(byType(undefined)).toMatchObject({ kind: 'puerta', widthMm: 900 });
  });

  it('sin ancho leído usa el del tipo, y la corredera estrecha es la corredera vista', () => {
    const read = apertures(raw([
      { tipo: 'puerta', muro: 3, posicion: 0.3, variante: 'plegable' },
      { tipo: 'puerta', muro: 3, posicion: 0.75, anchoSobreMuro: 0.2, variante: 'corredera' },
    ]));
    expect(read.map(({ catalogId, widthMm }) => ({ catalogId, widthMm }))).toEqual([
      { catalogId: 'puerta-plegable', widthMm: 800 },
      { catalogId: 'puerta-corredera', widthMm: 800 },
    ]);
  });

  it('una corredera sin arco no se descarta aunque otras puertas traigan los puntos del arco', () => {
    const source = raw([
      { tipo: 'puerta', muro: 1, posicion: 0.75, anchoSobreMuro: 0.3, variante: 'corredera' },
      { tipo: 'puerta', muro: 3, posicion: 0.3, arcVisible: true,
        arcGeometry: { hinge: { x: 0.4, y: 0.2 }, openingEnd: { x: 0.4, y: 0.29 }, arcPoint: { x: 0.49, y: 0.2 } } },
    ]);
    // Con cuatro estancias o más, la lectura exige arco creíble a las puertas abatibles.
    source.habitaciones.push({ nombre: 'Baño', poligono: [{ x: 0.7, y: 0.1 }, { x: 0.8, y: 0.1 }, { x: 0.8, y: 0.2 }, { x: 0.7, y: 0.2 }] });
    expect(apertures(source).some((aperture) => aperture.catalogId === 'puerta-corredera-vidrio')).toBe(true);
  });
});

describe('variante en los huecos medidos y en la relectura de símbolos', () => {
  it('el hueco medido hereda la variante de la lectura y la abertura sale con su tipo', () => {
    const seed = { tipo: 'puerta' as const, center: { x: 0.5, y: 0 }, variante: 'corredera' as const, sourceDirection: { x: 1, y: 0 } };
    const [gap] = seedsFromGaps([{ center: { x: 0.51, y: 0 }, width: 0.2, direction: { x: 1, y: 0 } }], [seed], [wall]);
    expect(gap).toMatchObject({ tipo: 'puerta', variante: 'corredera' });
    const planWall = { id: 'w0', from: { x: 0, y: 0 }, to: { x: 10000, y: 0 }, thicknessMm: 120 };
    const [aperture] = anchorApertures([gap!], [wall], [planWall], { mmPerUnitX: 10000, mmPerUnitY: 10000 },
      { snapDistance: 0.03 } as Parameters<typeof anchorApertures>[4]);
    expect(aperture).toMatchObject({ kind: 'puerta', widthMm: 2000, catalogId: 'puerta-corredera-vidrio' });
  });

  it('la relectura del arco conserva la puerta de entrada leída en la primera pasada', () => {
    const arc = { hinge: { x: 0.4, y: 0 }, openingEnd: { x: 0.49, y: 0 }, arcPoint: { x: 0.4, y: 0.09 } };
    const base: RawSketch = { muros: [wall], habitaciones: [],
      aberturas: [{ tipo: 'puerta', muro: 0, posicion: 0.445, arcVisible: true, arcGeometry: arc, variante: 'entrada' }] };
    const merged = mergePlanSymbols(base, { doors: [{ ...arc, arcPoint: { x: 0.4, y: 0.088 } }], windows: [] });
    expect(merged.aberturas).toHaveLength(1);
    expect(merged.aberturas[0]).toMatchObject({ variante: 'entrada', arcGeometry: { arcPoint: { y: 0.088 } } });
  });
});
