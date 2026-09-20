/**
 * Reconstrucción del plano desde las estancias: complejo cerrado por
 * construcción, muros sólo donde hay estancia interior, grosores por clase,
 * ventanas sólo en fachada, cuerpo de medida recortado y pistas de línea
 * partidas en vacíos interiores.
 */
import { describe, expect, it } from 'vitest';
import type { RawSketch, SketchRoom, SketchWall } from '@/server/ai/sketch/sketch-types';
import { prepareSketch } from '@/server/ai/sketch/normalize-geometry';
import { buildPlanFromRooms } from '@/server/ai/sketch/plan-from-rooms';

const sq = (x0: number, y0: number, x1: number, y1: number) => [
  { x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 },
];
const wall = (x1: number, y1: number, x2: number, y2: number, thickness: number): SketchWall => ({ x1, y1, x2, y2, thickness });

/** Casa de 6 × 4 m (0.1–0.7 × 0.1–0.5), tabique en x = 0.4, jardín debajo. Imagen cuadrada. */
function house(): { raw: RawSketch; walls: SketchWall[] } {
  const walls = [
    wall(0.1, 0.1, 0.7, 0.1, 0.012),
    wall(0.1, 0.5, 0.7, 0.5, 0.012),
    wall(0.1, 0.1, 0.1, 0.5, 0.012),
    wall(0.7, 0.1, 0.7, 0.5, 0.012),
    wall(0.4, 0.1, 0.4, 0.5, 0.006),
    // Segundo trazo fino (un tabique de armario): las clases de grosor exigen dos miembros por clase.
    wall(0.55, 0.15, 0.55, 0.3, 0.006),
  ];
  const raw: RawSketch = {
    anchoMetros: 6, altoMetros: 4, escalaFiable: true,
    muros: walls.map(({ x1, y1, x2, y2 }) => ({ x1, y1, x2, y2 })),
    aberturas: [{ tipo: 'ventana', muro: 0, posicion: 0.25, anchoSobreMuro: 0.15 }],
    habitaciones: [
      { nombre: 'A', poligono: sq(0.1, 0.1, 0.4, 0.5), anchoMetros: 3, altoMetros: 4 },
      { nombre: 'B', poligono: sq(0.4, 0.1, 0.7, 0.5) },
      { nombre: 'Jardín', poligono: sq(0.1, 0.5, 0.7, 0.7), exterior: true },
    ],
  };
  return { raw, walls };
}

const build = (raw: RawSketch, walls: SketchWall[], rooms: SketchRoom[] = raw.habitaciones) =>
  buildPlanFromRooms(rooms, prepareSketch(raw, { wallsOverride: walls, imageHeightOverWidth: 1 }));

describe('buildPlanFromRooms', () => {
  it('muros = aristas de estancias interiores; el jardín no aporta muros propios', () => {
    const { raw, walls } = house();
    const { plano } = build(raw, walls);
    const all = plano.zones.flatMap((z) => z.walls);
    // Perímetro (2 arriba, 2 abajo, izquierda, derecha) + tabique compartido = 7 tramos.
    expect(all).toHaveLength(7);
    const partition = all.find((w) => w.from.x === w.to.x && w.from.x === 4000);
    expect(partition).toBeDefined();
    // Nada por debajo de la fachada inferior (y = 5000): los lados libres del jardín son límite oculto.
    expect(all.every((w) => w.from.y <= 5000 && w.to.y <= 5000)).toBe(true);
    // Zonas: las dos estancias y el jardín, con su nombre.
    expect(plano.zones.map((z) => z.name)).toEqual(['A', 'B', 'Jardín']);
  });

  it('grosor por clase: fachada gruesa, tabique fino; contorno = luz entre caras', () => {
    const { raw, walls } = house();
    const { plano } = build(raw, walls);
    const all = plano.zones.flatMap((z) => z.walls);
    const partition = all.find((w) => w.from.x === 4000 && w.to.x === 4000)!;
    const facade = all.find((w) => w.from.y === 1000 && w.to.y === 1000)!;
    expect(partition.thicknessMm).toBeLessThan(facade.thicknessMm);
    const a = plano.zones[0]!;
    const xs = a.outline.map((p) => p.x);
    // 3000 entre ejes menos medio grosor de fachada y medio de tabique.
    const width = Math.max(...xs) - Math.min(...xs);
    expect(width).toBeLessThan(3000);
    expect(width).toBeGreaterThan(2800);
  });

  it('la ventana leída en fachada se conserva; en un tabique no', () => {
    const { raw, walls } = house();
    const withInteriorWindow: RawSketch = {
      ...raw,
      aberturas: [...raw.aberturas, { tipo: 'ventana', muro: 4, posicion: 0.5, anchoSobreMuro: 0.2 }],
    };
    const { plano } = build(withInteriorWindow, walls);
    const windows = plano.zones.flatMap((z) => z.apertures).filter((a) => a.kind === 'ventana');
    expect(windows).toHaveLength(1);
    const wallOf = plano.zones.flatMap((z) => z.walls).find((w) => w.id === windows[0]!.wallId)!;
    expect(wallOf.from.y).toBe(1000);
  });

  it('una estancia en L con cotas que no abarcan la L mide su cuerpo principal, pero sus muros siguen la L', () => {
    const walls = [
      wall(0.1, 0.1, 0.4, 0.1, 0.012), wall(0.1, 0.6, 0.4, 0.6, 0.012),
      wall(0.1, 0.1, 0.1, 0.6, 0.012), wall(0.4, 0.1, 0.4, 0.6, 0.012),
    ];
    const raw: RawSketch = {
      anchoMetros: 3, altoMetros: 5, escalaFiable: true, muros: [], aberturas: [],
      habitaciones: [{
        nombre: 'L',
        // 3 × 4 m de cuerpo más una pata de 1 × 1 m abajo a la izquierda; cota escrita 3 × 4.
        poligono: [{ x: 0.1, y: 0.1 }, { x: 0.4, y: 0.1 }, { x: 0.4, y: 0.5 }, { x: 0.2, y: 0.5 }, { x: 0.2, y: 0.6 }, { x: 0.1, y: 0.6 }],
        anchoMetros: 3, altoMetros: 4,
      }],
    };
    const { plano } = build(raw, walls);
    const zone = plano.zones[0]!;
    const ys = zone.outline.map((p) => p.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(4000);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(3800);
    // La pata sigue existiendo como muros (fondo en y = 6000).
    expect(zone.walls.some((w) => w.from.y === 6000 && w.to.y === 6000)).toBe(true);
  });

  it('las pistas de línea se parten donde el muro medido cruza un vacío interior cerrado', () => {
    // Dos filas de estancias con un pasillo sin estancia leída entre ellas, cerrado
    // en sus extremos por dos cuartos pequeños; un muro medido cruza el pasillo.
    const walls = [
      wall(0.1, 0.1, 0.7, 0.1, 0.012), wall(0.1, 0.6, 0.7, 0.6, 0.012),
      wall(0.1, 0.1, 0.1, 0.6, 0.012), wall(0.7, 0.1, 0.7, 0.6, 0.012),
      wall(0.4, 0.1, 0.4, 0.6, 0.006),
    ];
    const raw: RawSketch = {
      anchoMetros: 6, altoMetros: 5, escalaFiable: true, muros: [], aberturas: [],
      habitaciones: [
        { nombre: 'A', poligono: sq(0.1, 0.1, 0.4, 0.3) }, { nombre: 'B', poligono: sq(0.4, 0.1, 0.7, 0.3) },
        { nombre: 'C', poligono: sq(0.1, 0.4, 0.4, 0.6) }, { nombre: 'D', poligono: sq(0.4, 0.4, 0.7, 0.6) },
        { nombre: 'E', poligono: sq(0.1, 0.3, 0.2, 0.4) }, { nombre: 'F', poligono: sq(0.6, 0.3, 0.7, 0.4) },
      ],
    };
    const { lineHints } = build(raw, walls);
    const atPartition = lineHints.filter((h) => Math.abs(h.x1 - 0.4) < 1e-6 && Math.abs(h.x2 - 0.4) < 1e-6);
    expect(atPartition.length).toBe(2);
    expect(atPartition.every((h) => Math.max(h.y1, h.y2) <= 0.3 + 0.01 || Math.min(h.y1, h.y2) >= 0.4 - 0.01)).toBe(true);
    // La fachada izquierda no cruza ningún vacío cerrado: una sola pista entera.
    const left = lineHints.filter((h) => Math.abs(h.x1 - 0.1) < 1e-6 && Math.abs(h.x2 - 0.1) < 1e-6);
    expect(left).toHaveLength(1);
  });
});
