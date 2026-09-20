import { describe, expect, it } from 'vitest';
import { zonesFromRooms } from '@/server/ai/sketch/zones-from-rooms';

// Muros medidos: perímetro 0.1–0.7 × 0.1–0.5 y un tabique en x = 0.4. Falta el
// tabique horizontal en y = 0.3 que separa dos estancias de la mitad derecha.
const walls = [
  { x1: 0.1, y1: 0.1, x2: 0.7, y2: 0.1 },
  { x1: 0.1, y1: 0.5, x2: 0.7, y2: 0.5 },
  { x1: 0.1, y1: 0.1, x2: 0.1, y2: 0.5 },
  { x1: 0.4, y1: 0.1, x2: 0.4, y2: 0.5 },
  { x1: 0.7, y1: 0.1, x2: 0.7, y2: 0.5 },
];
const sq = (x0: number, y0: number, x1: number, y1: number) => [
  { x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 },
];

describe('zonesFromRooms', () => {
  it('ancla las cajas del modelo a las líneas medidas y crea el tabique que falta', () => {
    const { rooms, addedWalls } = zonesFromRooms(
      [
        { nombre: 'Dormitorio', poligono: sq(0.11, 0.09, 0.39, 0.51), anchoMetros: 3 },
        { nombre: 'Cocina', poligono: sq(0.41, 0.1, 0.69, 0.29) },
        { nombre: 'Salón', poligono: sq(0.41, 0.31, 0.69, 0.5) },
      ],
      walls, 0.03,
    );
    expect(rooms).toHaveLength(3);
    // Coordenadas ancladas a los muros medidos, no a la lectura aproximada.
    expect(rooms[0]).toMatchObject({ name: 'Dormitorio', minX: 0.1, maxX: 0.4, minY: 0.1, maxY: 0.5, widthM: 3 });
    // El tabique y ≈ 0.3 no existe en el raster: se crea una sola vez para las dos estancias.
    expect(addedWalls).toHaveLength(1);
    expect(addedWalls[0]!.y1).toBeCloseTo(0.29, 2);
    expect(addedWalls[0]!.x1).toBe(0.4);
    expect(addedWalls[0]!.x2).toBe(0.7);
  });

  it('una estancia exterior se ancla pero no genera muros', () => {
    const { rooms, addedWalls } = zonesFromRooms(
      [{ nombre: 'Terraza', exterior: true, poligono: sq(0.1, 0.51, 0.7, 0.7) }],
      walls, 0.03,
    );
    expect(rooms[0]).toMatchObject({ name: 'Terraza', exterior: true, minY: 0.5 });
    expect(addedWalls).toEqual([]);
  });

  it('descarta cajas degeneradas', () => {
    const { rooms } = zonesFromRooms([{ nombre: 'Punto', poligono: sq(0.2, 0.2, 0.21, 0.21) }], walls, 0.03);
    expect(rooms).toEqual([]);
  });
});

describe('zonesFromRooms: anclaje guiado por cotas', () => {
  // Dos líneas candidatas para el fondo de la estancia: y = 0.3 y y = 0.36.
  const twoBottoms = [
    { x1: 0.1, y1: 0.1, x2: 0.4, y2: 0.1 },
    { x1: 0.1, y1: 0.1, x2: 0.1, y2: 0.4 },
    { x1: 0.4, y1: 0.1, x2: 0.4, y2: 0.4 },
    { x1: 0.1, y1: 0.3, x2: 0.4, y2: 0.3 },
    { x1: 0.1, y1: 0.36, x2: 0.4, y2: 0.36 },
  ];
  const guide = { mmPerUnitX: 10000, mmPerUnitY: 10000, thicknessUnit: 0.012 };

  it('sin cota se queda con la línea más cercana', () => {
    const { rooms } = zonesFromRooms([{ nombre: 'Sala', poligono: sq(0.1, 0.1, 0.4, 0.35) }], twoBottoms, 0.03, guide);
    expect(rooms[0]!.maxY).toBe(0.36);
  });

  it('con cota escrita elige la línea que la cumple aunque no sea la más cercana', () => {
    // 1,90 m entre caras ≈ 0.202 unidades entre ejes: la línea y = 0.3 (0.2), no la de 0.36 (0.26).
    const { rooms, addedWalls } = zonesFromRooms(
      [{ nombre: 'Sala', poligono: sq(0.1, 0.1, 0.4, 0.35), altoMetros: 1.9 }],
      twoBottoms, 0.03, guide,
    );
    expect(rooms[0]!.maxY).toBe(0.3);
    expect(addedWalls).toEqual([]);
  });
});
