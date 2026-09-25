/**
 * Reconstrucción del plano desde las estancias: complejo cerrado por
 * construcción, muros sólo donde hay estancia interior, grosores por clase,
 * ventanas interiores revisables, cuerpo de medida recortado y pistas de línea
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
  it('posa un tabique sobre la banda raster original aunque la limpieza desplace su eje', () => {
    const { raw, walls } = house();
    const prepared = prepareSketch(raw, { wallsOverride: walls, imageHeightOverWidth: 1 });
    prepared.walls = prepared.walls.map((segment) =>
      segment.x1 === 0.4 && segment.x2 === 0.4
        ? { ...segment, x1: 0.385, x2: 0.385 } : segment);
    const result = buildPlanFromRooms(raw.habitaciones, prepared);
    expect(result.debug.gridX.find((line) => line.min === 0.4)?.value).toBe(0.4);
    expect(result.plano.zones.flatMap((zone) => zone.walls).some((segment) =>
      segment.from.x === 4000 && segment.to.x === 4000)).toBe(true);
  });

  it('conserva la pared del baño entre dos jambas medidas aunque el vano borre su banda central', () => {
    const rooms: SketchRoom[] = [
      { nombre: 'Baño', poligono: sq(0.1, 0.1, 0.4, 0.3) },
      { nombre: 'Dormitorio', poligono: sq(0.1, 0.3, 0.4, 0.6) },
      { nombre: 'Pasillo', poligono: sq(0.4, 0.1, 0.7, 0.6) },
    ];
    const raw: RawSketch = {
      anchoMetros: 6, habitaciones: rooms,
      muros: [
        { x1: 0.1, y1: 0.1, x2: 0.7, y2: 0.1 },
        { x1: 0.1, y1: 0.3, x2: 0.7, y2: 0.3 },
        { x1: 0.4, y1: 0.3, x2: 0.4, y2: 0.6 },
        { x1: 0.4, y1: 0.2, x2: 0.4, y2: 0.28 },
      ],
      aberturas: [{ tipo: 'puerta', muro: 3, posicion: 0.5, arcVisible: true,
        arcGeometry: { hinge: { x: 0.4, y: 0.2 }, openingEnd: { x: 0.4, y: 0.28 },
          arcPoint: { x: 0.34, y: 0.24 } } }],
    };
    const pixels = [
      wall(0.1, 0.1, 0.7, 0.1, 0.006), wall(0.1, 0.3, 0.7, 0.3, 0.006),
      wall(0.1, 0.6, 0.7, 0.6, 0.006), wall(0.1, 0.1, 0.1, 0.6, 0.006),
      wall(0.7, 0.1, 0.7, 0.6, 0.006), wall(0.4, 0.3, 0.4, 0.6, 0.006),
    ];
    const result = build(raw, pixels);
    const bath = result.plano.zones.find((zone) => zone.name === 'Baño')!;
    const rightWall = bath.walls.find((segment) => segment.from.x === segment.to.x &&
      segment.from.x === Math.max(...bath.walls.flatMap((wall) => [wall.from.x, wall.to.x])));
    expect(rightWall).toBeDefined();
    expect(bath.apertures.some((aperture) => aperture.kind === 'puerta' &&
      aperture.wallId === rightWall?.id)).toBe(true);
  });

  it('no inventa un tabique entre jardín y servicios y conserva su límite con el dormitorio', () => {
    const rooms: SketchRoom[] = [
      { nombre: 'Jardín', poligono: sq(0.1, 0.1, 0.3, 0.3), exterior: true },
      { nombre: 'Servicios', poligono: sq(0.3, 0.1, 0.5, 0.3) },
      { nombre: 'Dormitorio', poligono: sq(0.1, 0.3, 0.5, 0.5) },
    ];
    const raw: RawSketch = {
      anchoMetros: 4, escalaFiable: true, habitaciones: rooms, aberturas: [],
      muros: [wall(0.1, 0.1, 0.5, 0.1, 0), wall(0.1, 0.3, 0.5, 0.3, 0),
        wall(0.1, 0.1, 0.1, 0.5, 0), wall(0.5, 0.1, 0.5, 0.5, 0),
        wall(0.3, 0.1, 0.3, 0.3, 0)],
    };
    const pixels = [
      wall(0.1, 0.1, 0.5, 0.1, 0.003), wall(0.1, 0.3, 0.5, 0.3, 0.003),
      // Doble trazo del cerramiento del jardín; un borde aislado no bastaría.
      wall(0.1, 0.108, 0.3, 0.108, 0.003),
      wall(0.1, 0.1, 0.1, 0.5, 0.01), wall(0.5, 0.1, 0.5, 0.5, 0.01),
      wall(0.3, 0.1, 0.3, 0.3, 0.001),
    ];
    const { plano } = build(raw, pixels);
    const all = plano.zones.flatMap((zone) => zone.walls);
    expect(all.some((w) => w.from.x === w.to.x && Math.abs(w.from.x - 3000) < 2)).toBe(false);
    expect(all.some((w) => w.from.y === w.to.y && Math.abs(w.from.y - 1000) < 30 &&
      Math.min(w.from.x, w.to.x) <= 3000 && Math.max(w.from.x, w.to.x) >= 5000)).toBe(true);
    expect(all.some((w) => w.from.y === w.to.y && Math.abs(w.from.y - 3000) < 2)).toBe(true);
    expect(all.some((w) => w.from.y === w.to.y && Math.abs(w.from.y - 1000) < 30 &&
      Math.min(w.from.x, w.to.x) <= 1000 && Math.max(w.from.x, w.to.x) >= 3000)).toBe(true);
  });

  it('conserva aristas y tabiques interiores medidos; el jardín no aporta muros propios', () => {
    const { raw, walls } = house();
    const { plano } = build(raw, walls);
    const all = plano.zones.flatMap((z) => z.walls);
    // Perímetro, tabique compartido y tabique de armario confirmado por píxeles.
    expect(all).toHaveLength(8);
    const partition = all.find((w) => w.from.x === w.to.x && w.from.x === 4000);
    expect(partition).toBeDefined();
    expect(all.some((w) => w.from.x === 5500 && w.to.x === 5500)).toBe(true);
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

  it('omite un tabique interior sugerido sin trazo visible en el original', () => {
    const { raw, walls } = house();
    raw.muros.push({ x1: 0.6, y1: 0.15, x2: 0.6, y2: 0.3 });
    const { plano } = build(raw, walls);
    expect(plano.zones.flatMap((zone) => zone.walls).some((w) =>
      w.from.x === 6000 && w.to.x === 6000)).toBe(false);
  });

  it('conserva la pared de un clóset ocupada casi toda por una puerta con arco observado', () => {
    const outline = [wall(0.1, 0.1, 0.7, 0.1, 0.012), wall(0.1, 0.7, 0.7, 0.7, 0.012),
      wall(0.1, 0.1, 0.1, 0.7, 0.012), wall(0.7, 0.1, 0.7, 0.7, 0.012)];
    const closetSide = { x1: 0.4, y1: 0.1, x2: 0.4, y2: 0.3 };
    const closetBottom = wall(0.4, 0.3, 0.6, 0.3, 0.008);
    const raw: RawSketch = {
      anchoMetros: 6, escalaFiable: true,
      habitaciones: [{ nombre: 'Dormitorio', poligono: sq(0.1, 0.1, 0.7, 0.7) }],
      muros: [...outline, closetSide, closetBottom],
      aberturas: [{ tipo: 'puerta', muro: 4, posicion: 0.5, arcVisible: true,
        arcGeometry: { hinge: { x: 0.4, y: 0.14 }, openingEnd: { x: 0.4, y: 0.26 },
          arcPoint: { x: 0.5, y: 0.2 } } }],
    };
    const { plano } = build(raw, [...outline, closetBottom]);
    expect(plano.zones.flatMap((zone) => zone.walls).some((w) =>
      w.from.x === 4000 && w.to.x === 4000 && w.from.y === 1000 && w.to.y === 3000)).toBe(true);
    expect(plano.zones.flatMap((zone) => zone.apertures).filter((a) => a.kind === 'puerta')).toHaveLength(1);
  });

  it('conserva la ventana interior leída y avisa de que requiere revisión', () => {
    const { raw, walls } = house();
    const withInteriorWindow: RawSketch = {
      ...raw,
      aberturas: [...raw.aberturas, { tipo: 'ventana', muro: 4, posicion: 0.5, anchoSobreMuro: 0.2 }],
    };
    const { plano, warnings } = build(withInteriorWindow, walls);
    const windows = plano.zones.flatMap((z) => z.apertures).filter((a) => a.kind === 'ventana');
    expect(windows).toHaveLength(2);
    expect(warnings).toContainEqual(expect.objectContaining({ code: 'ventana-interior-por-revisar' }));
  });

  it('conserva una ventana entre jardín y vivienda como abertura exterior', () => {
    const { raw, walls } = house();
    const withGardenWindow = { ...raw, aberturas: [
      ...raw.aberturas, { tipo: 'ventana' as const, muro: 1, posicion: 0.25, anchoSobreMuro: 0.15 },
    ] };
    const { plano, warnings } = build(withGardenWindow, walls);
    expect(plano.zones.flatMap((zone) => zone.apertures).filter((aperture) => aperture.kind === 'ventana')).toHaveLength(2);
    expect(warnings.some((warning) => warning.code === 'ventana-interior-por-revisar')).toBe(false);
  });

  it('no abre una puerta sugerida por el modelo sobre un muro sólido medido', () => {
    const { raw, walls } = house();
    const withPhantomDoor: RawSketch = {
      ...raw,
      aberturas: [...raw.aberturas, { tipo: 'puerta', muro: 3, posicion: 0.5, anchoSobreMuro: 0.2 }],
    };
    const { plano } = build(withPhantomDoor, walls);
    expect(plano.zones.flatMap((zone) => zone.apertures).filter((a) => a.kind === 'puerta')).toHaveLength(0);
  });

  it('no prolonga un tabique parcial por toda la arista de una estancia', () => {
    const rooms: SketchRoom[] = [
      { nombre: 'Arriba', poligono: sq(0.1, 0.1, 0.9, 0.5) },
      { nombre: 'Abajo', poligono: sq(0.1, 0.5, 0.9, 0.9) },
    ];
    const pixels = [
      wall(0.1, 0.1, 0.9, 0.1, 0.012), wall(0.1, 0.9, 0.9, 0.9, 0.012),
      wall(0.1, 0.1, 0.1, 0.9, 0.012), wall(0.9, 0.1, 0.9, 0.9, 0.012),
      wall(0.5, 0.5, 0.9, 0.5, 0.008),
    ];
    const raw: RawSketch = {
      habitaciones: rooms, anchoMetros: 8, escalaFiable: true,
      muros: [{ x1: 0.5, y1: 0.5, x2: 0.9, y2: 0.5 }], aberturas: [],
    };
    const { plano } = build(raw, pixels);
    const crossing = (x: number) => plano.zones.flatMap((zone) => zone.walls).some((w) =>
      w.from.y === w.to.y && Math.abs(w.from.y - 5000) < 2 &&
      Math.min(w.from.x, w.to.x) < x && Math.max(w.from.x, w.to.x) > x);
    expect(crossing(3000)).toBe(false);
    expect(crossing(7000)).toBe(true);
  });

  it('recupera un tabique fino respaldado por visión y uniones medidas, pero avisa que falta respaldo raster', () => {
    const { raw, walls } = house();
    const withoutPartition = walls.filter((w) => w.x1 !== 0.4 || w.x2 !== 0.4);
    const { plano, warnings } = build(raw, withoutPartition);
    const partition = plano.zones.flatMap((zone) => zone.walls).find((w) =>
      w.from.x === 4000 && w.to.x === 4000 && w.from.y === 1000 && w.to.y === 5000);
    expect(partition).toBeDefined();
    expect(warnings).toContainEqual(expect.objectContaining({ code: 'muro-solo-modelo' }));
  });

  it('un hueco con una puerta sugerida solo se convierte en puerta si se vio el arco', () => {
    const { raw, walls } = house();
    const withGap = [
      ...walls.filter((w) => w.x1 !== 0.4 || w.x2 !== 0.4),
      wall(0.4, 0.1, 0.4, 0.25, 0.006), wall(0.4, 0.35, 0.4, 0.5, 0.006),
    ];
    const suggested: RawSketch = {
      ...raw, aberturas: [{ tipo: 'puerta', muro: 4, posicion: 0.5, anchoSobreMuro: 0.2 }],
    };
    const uncertain = build(suggested, withGap).plano.zones.flatMap((zone) => zone.apertures);
    expect(uncertain.some((aperture) => aperture.kind === 'puerta')).toBe(false);
    const confirmed = build({ ...suggested, aberturas: [{ ...suggested.aberturas[0]!, arcVisible: true }] }, withGap)
      .plano.zones.flatMap((zone) => zone.apertures);
    expect(confirmed.some((aperture) => aperture.kind === 'puerta')).toBe(true);
  });

  it('reubica una puerta de una unión en T al tramo con hueco medido y descarta el giro de otro eje', () => {
    const rooms: SketchRoom[] = [
      { nombre: 'Dormitorio', poligono: sq(0.1, 0.1, 0.5, 0.4) },
      { nombre: 'Pasillo', poligono: sq(0.5, 0.1, 0.8, 0.5) },
    ];
    const pixels = [
      wall(0.1, 0.1, 0.8, 0.1, 0.012), wall(0.1, 0.1, 0.1, 0.4, 0.012),
      wall(0.1, 0.4, 0.44, 0.4, 0.006), wall(0.5, 0.1, 0.5, 0.5, 0.008),
      wall(0.8, 0.1, 0.8, 0.5, 0.012), wall(0.5, 0.5, 0.8, 0.5, 0.012),
    ];
    const raw: RawSketch = {
      anchoMetros: 7, altoMetros: 4, escalaFiable: true, habitaciones: rooms,
      muros: [{ x1: 0.5, y1: 0.1, x2: 0.5, y2: 0.5 }],
      aberturas: [{ tipo: 'puerta', muro: 0, posicion: 0.72, anchoSobreMuro: 0.18,
        swing: 'left', hinge: 'left' }],
    };
    const { plano } = build(raw, pixels);
    const doors = plano.zones.flatMap((zone) => zone.apertures.filter((a) => a.kind === 'puerta'));
    expect(doors).toHaveLength(1);
    const on = plano.zones.flatMap((zone) => zone.walls).find((w) => w.id === doors[0]!.wallId)!;
    expect(on.from.y).toBe(on.to.y);
    expect(doors[0]!.swing).toBeUndefined();
    expect(doors[0]!.hinge).toBeUndefined();
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
