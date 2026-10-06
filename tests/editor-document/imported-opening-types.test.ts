/**
 * Al pasar el plano importado al editor, cada puerta y ventana lleva su tipo: el que distinguió la lectura y, si no,
 * el de sentido común (puerta de entrada en la fachada a la calle, corredera de vidrio en un paso ancho a la terraza).
 */
import { describe, expect, it } from 'vitest';
import type { PlanAperture, PlanImportResult } from '@/lib/contracts';
import { fromPlanImport } from '@/lib/editor-document/adapters/plano2d-import';
import { openingType } from '@/lib/editor-document/opening-types';

/**
 * Casa de 6 × 4 m partida por un tabique en x = 3000, con una terraza de 6 × 2 m al sur (y = 4000). Como en la
 * importación real, las fachadas norte (n1, n2) y sur (s1, s2) ya están partidas en la unión con el tabique.
 */
function importResult(apertures: PlanAperture[]): PlanImportResult {
  const T = 200;
  const walls = [
    { id: 'n1', from: { x: 0, y: 0 }, to: { x: 3000, y: 0 }, thicknessMm: T },
    { id: 'n2', from: { x: 3000, y: 0 }, to: { x: 6000, y: 0 }, thicknessMm: T },
    { id: 's1', from: { x: 0, y: 4000 }, to: { x: 3000, y: 4000 }, thicknessMm: T },
    { id: 's2', from: { x: 3000, y: 4000 }, to: { x: 6000, y: 4000 }, thicknessMm: T },
    { id: 'w', from: { x: 0, y: 0 }, to: { x: 0, y: 4000 }, thicknessMm: T },
    { id: 'e', from: { x: 6000, y: 0 }, to: { x: 6000, y: 4000 }, thicknessMm: T },
    { id: 'm', from: { x: 3000, y: 0 }, to: { x: 3000, y: 4000 }, thicknessMm: 100 },
  ];
  const box = (x0: number, x1: number) => [{ x: x0, y: 100 }, { x: x1, y: 100 }, { x: x1, y: 3900 }, { x: x0, y: 3900 }];
  return {
    plano: { schemaVersion: 1, zones: [
      { id: 'z0', name: 'Dormitorio', walls, apertures, dimensions: [], outline: box(100, 2950) },
      { id: 'z1', name: 'Salón', walls: [], apertures: [], dimensions: [], outline: box(3050, 5900) },
    ] },
    escalaEstimada: false, writtenDimensions: [], corrections: [], furniture: [], warnings: [],
    exteriors: [{
      id: 'ext0', name: 'Terraza',
      outline: [{ x: 0, y: 4000 }, { x: 6000, y: 4000 }, { x: 6000, y: 6000 }, { x: 0, y: 6000 }],
      hiddenBoundaries: [
        { from: { x: 6000, y: 4000 }, to: { x: 6000, y: 6000 } },
        { from: { x: 6000, y: 6000 }, to: { x: 0, y: 6000 } },
        { from: { x: 0, y: 6000 }, to: { x: 0, y: 4000 } },
      ],
    }],
  };
}

const opening = (apertures: PlanAperture[], id: string) => {
  const { document, issues } = fromPlanImport(importResult(apertures));
  expect(issues).toEqual([]);
  return document!.openings.find((item) => item.id === id)!;
};

describe('tipo de las puertas y ventanas importadas', () => {
  it('lleva el tipo leído con su altura y su cota: la balconera llega al suelo', () => {
    const apertures: PlanAperture[] = [
      { id: 'balconera', kind: 'ventana', wallId: 's1', position: 0.5, widthMm: 1200, catalogId: 'ventana-balconera' },
      { id: 'doble', kind: 'puerta', wallId: 'm', position: 0.5, widthMm: 1400, catalogId: 'puerta-doble' },
    ];
    expect(opening(apertures, 'balconera')).toMatchObject({ catalogId: 'ventana-balconera', widthMm: 1200, heightMm: 2100, elevationMm: 0 });
    expect(opening(apertures, 'doble')).toMatchObject({ kind: 'puerta', catalogId: 'puerta-doble', widthMm: 1400 });
  });

  it('ignora un tipo de otra clase o desconocido y deja la abertura básica', () => {
    const apertures: PlanAperture[] = [
      { id: 'v', kind: 'ventana', wallId: 'n1', position: 0.5, widthMm: 1200, catalogId: 'puerta-doble' },
      { id: 'p', kind: 'puerta', wallId: 'm', position: 0.5, widthMm: 900, catalogId: 'puerta-blindada-xl' },
    ];
    expect(openingType(opening(apertures, 'v'))!.id).toBe('ventana-basic');
    expect(openingType(opening(apertures, 'p'))!.id).toBe('puerta-basic');
  });

  it('la puerta sin marca en la fachada a la calle es la de entrada; la interior se queda básica', () => {
    const apertures: PlanAperture[] = [
      { id: 'calle', kind: 'puerta', wallId: 'n2', position: 0.5, widthMm: 900 },
      { id: 'paso', kind: 'puerta', wallId: 'm', position: 0.5, widthMm: 800 },
    ];
    expect(opening(apertures, 'calle')).toMatchObject({ catalogId: 'puerta-entrada', widthMm: 900 });
    expect(openingType(opening(apertures, 'paso'))!.id).toBe('puerta-basic');
  });

  it('si la lectura ya señaló la entrada, las demás puertas de la fachada no lo son', () => {
    const apertures: PlanAperture[] = [
      { id: 'principal', kind: 'puerta', wallId: 'e', position: 0.5, widthMm: 950, catalogId: 'puerta-entrada' },
      { id: 'servicio', kind: 'puerta', wallId: 'n1', position: 0.5, widthMm: 800 },
    ];
    expect(opening(apertures, 'principal').catalogId).toBe('puerta-entrada');
    expect(openingType(opening(apertures, 'servicio'))!.id).toBe('puerta-basic');
  });

  it('un paso ancho sin hoja a la terraza es una corredera de vidrio, y también la corredera leída en esa pared', () => {
    const apertures: PlanAperture[] = [
      { id: 'salida', kind: 'hueco', wallId: 's2', position: 0.5, widthMm: 1800 },
      { id: 'corredera', kind: 'puerta', wallId: 's1', position: 0.5, widthMm: 900, catalogId: 'puerta-corredera' },
    ];
    expect(opening(apertures, 'salida')).toMatchObject({ kind: 'puerta', catalogId: 'puerta-corredera-vidrio', widthMm: 1800, elevationMm: 0, heightMm: 2100 });
    expect(opening(apertures, 'corredera').catalogId).toBe('puerta-corredera-vidrio');
  });

  it('un paso estrecho a la terraza o uno ancho en un tabique siguen siendo huecos', () => {
    const apertures: PlanAperture[] = [
      { id: 'estrecho', kind: 'hueco', wallId: 's1', position: 0.5, widthMm: 1000 },
      { id: 'interior', kind: 'hueco', wallId: 'm', position: 0.5, widthMm: 1600 },
    ];
    expect(opening(apertures, 'estrecho').kind).toBe('hueco');
    expect(opening(apertures, 'interior').kind).toBe('hueco');
  });
});
