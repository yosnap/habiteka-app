import { describe, it, expect } from 'vitest';
import {
  buildShapeOutline,
  isValidShape,
  outlineToWalls,
  roomOutline,
  type Pt,
  type RoomShapeParams,
} from '@/canvas/wizard/room-shapes';
import { buildShapeDoc } from '@/canvas/wizard/build-room-doc';
import { docToScene } from '@/canvas/3d/doc-to-scene';

const ORIGIN: Pt = { x: 120, y: 120 };
// 100 px/m, grosor 0,15 m → 15 px.
const T = 15;

describe('room-shapes: validación de forma', () => {
  it('acepta el rectángulo con medidas positivas', () => {
    expect(isValidShape({ shape: 'rect', widthM: 4, lengthM: 3 })).toBe(true);
    expect(isValidShape({ shape: 'rect', widthM: 0, lengthM: 3 })).toBe(false);
  });

  it('exige que los recortes/entrantes quepan dentro del total', () => {
    expect(
      isValidShape({ shape: 'l', widthM: 5, lengthM: 4, cutWidthM: 2, cutLengthM: 2 }),
    ).toBe(true);
    // recorte tan ancho como el total → inválido
    expect(
      isValidShape({ shape: 'l', widthM: 5, lengthM: 4, cutWidthM: 5, cutLengthM: 2 }),
    ).toBe(false);
    expect(
      isValidShape({ shape: 'u', widthM: 6, lengthM: 4, notchWidthM: 2, notchLengthM: 2 }),
    ).toBe(true);
    expect(
      isValidShape({ shape: 'u', widthM: 6, lengthM: 4, notchWidthM: 2, notchLengthM: 5 }),
    ).toBe(false);
    expect(
      isValidShape({ shape: 't', widthM: 6, lengthM: 5, barLengthM: 2, stemWidthM: 2 }),
    ).toBe(true);
    expect(
      isValidShape({ shape: 't', widthM: 6, lengthM: 5, barLengthM: 6, stemWidthM: 2 }),
    ).toBe(false);
  });
});

describe('room-shapes: REGRESIÓN del rectángulo (geometría histórica byte-idéntica)', () => {
  // Oráculo: la geometría que generaba `buildRoomDoc` antes de delegar en room-shapes.
  // Interior w×l en px, origen (x0,y0), grosor t. Muros: top/bottom abarcan w+2t; left/right = l.
  it('reproduce los 4 muros del rectángulo con sus coordenadas exactas', () => {
    const w = 500; // 5 m
    const l = 400; // 4 m
    const { walls } = buildShapeOutline(
      { shape: 'rect', widthM: 5, lengthM: 4 },
      ORIGIN,
      100,
      0.15,
    );
    const { x: x0, y: y0 } = ORIGIN;
    // Conjunto esperado (independiente del orden e ids): mismas cajas que el rect original.
    const expected = [
      { x: x0 - T, y: y0 - T, width: w + 2 * T, height: T }, // top
      { x: x0 - T, y: y0 + l, width: w + 2 * T, height: T }, // bottom
      { x: x0 - T, y: y0, width: T, height: l }, // left
      { x: x0 + w, y: y0, width: T, height: l }, // right
    ];
    expect(walls).toHaveLength(4);
    for (const e of expected) {
      const match = walls.find(
        (m) =>
          Math.abs(m.x - e.x) < 1e-6 &&
          Math.abs(m.y - e.y) < 1e-6 &&
          Math.abs(m.width - e.width) < 1e-6 &&
          Math.abs(m.height - e.height) < 1e-6,
      );
      expect(match, `falta el muro ${JSON.stringify(e)}`).toBeDefined();
      expect(match?.rotation).toBe(0);
      expect(match?.kind).toBe('wall');
    }
  });
});

/** ¿El contorno es cerrado y ortogonal (cada arista horizontal o vertical)? */
function isClosedOrthogonal(vertices: Pt[]): boolean {
  const n = vertices.length;
  if (n < 4) return false;
  for (let i = 0; i < n; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % n];
    if (!a || !b) return false;
    const horizontal = Math.abs(a.y - b.y) < 1e-6;
    const vertical = Math.abs(a.x - b.x) < 1e-6;
    if (horizontal === vertical) return false; // ni axis-aligned, o arista degenerada
  }
  return true;
}

/** ¿Los muros adyacentes (consecutivos) se TOCAN/solapan (sin huecos en esquinas)? */
function wallsTouch(walls: ReturnType<typeof outlineToWalls>): boolean {
  // Cada esquina del contorno debe estar cubierta por algún muro horizontal (que abarca
  // las esquinas). Comprobamos que los bounding boxes de muros consecutivos se solapan.
  const overlaps = (a: (typeof walls)[number], b: (typeof walls)[number]) => {
    const ax2 = a.x + a.width;
    const ay2 = a.y + a.height;
    const bx2 = b.x + b.width;
    const by2 = b.y + b.height;
    return a.x <= bx2 && b.x <= ax2 && a.y <= by2 && b.y <= ay2;
  };
  for (let i = 0; i < walls.length; i++) {
    const a = walls[i];
    const b = walls[(i + 1) % walls.length];
    if (!a || !b) return false;
    if (!overlaps(a, b)) return false;
  }
  return true;
}

describe('room-shapes: formas no rectangulares', () => {
  const cases: Array<{ name: string; params: RoomShapeParams; vertices: number; walls: number }> = [
    {
      name: 'L (recorte de una esquina)',
      params: { shape: 'l', widthM: 5, lengthM: 4, cutWidthM: 2, cutLengthM: 2 },
      vertices: 6,
      walls: 6,
    },
    {
      name: 'U (entrante central)',
      params: { shape: 'u', widthM: 6, lengthM: 4, notchWidthM: 2, notchLengthM: 2 },
      vertices: 8,
      walls: 8,
    },
    {
      name: 'T (barra + vástago)',
      params: { shape: 't', widthM: 6, lengthM: 5, barLengthM: 2, stemWidthM: 2 },
      vertices: 8,
      walls: 8,
    },
  ];

  for (const c of cases) {
    it(`${c.name}: contorno cerrado, ortogonal, con el nº de muros esperado`, () => {
      const local = roomOutline(c.params, 100);
      expect(local).toHaveLength(c.vertices);
      expect(isClosedOrthogonal(local)).toBe(true);

      const { vertices, walls } = buildShapeOutline(c.params, ORIGIN, 100, 0.15);
      expect(vertices).toHaveLength(c.vertices);
      expect(walls).toHaveLength(c.walls);
      expect(walls.every((w) => w.kind === 'wall' && w.rotation === 0)).toBe(true);
      expect(wallsTouch(walls)).toBe(true);
    });
  }

  it('formas inválidas devuelven contorno vacío', () => {
    expect(roomOutline({ shape: 'l', widthM: 5, lengthM: 4, cutWidthM: 9, cutLengthM: 2 })).toEqual(
      [],
    );
  });
});

describe('build-room-doc: suelo poligonal en formas no rectangulares', () => {
  it('el rectángulo NO lleva floorOutline (suelo por bbox, sin regresión)', () => {
    const doc = buildShapeDoc({ shape: { shape: 'rect', widthM: 5, lengthM: 4 }, ceilingHeightM: 2.5 });
    expect(doc.floorOutline).toBeUndefined();
    expect(docToScene(doc).floor.polygon).toBeUndefined();
  });

  it('la L lleva floorOutline y docToScene expone el polígono del suelo', () => {
    const doc = buildShapeDoc({
      shape: { shape: 'l', widthM: 5, lengthM: 4, cutWidthM: 2, cutLengthM: 2 },
      ceilingHeightM: 2.5,
    });
    expect(doc.floorOutline).toHaveLength(6);
    const scene = docToScene(doc);
    expect(scene.floor.polygon).toBeDefined();
    expect(scene.floor.polygon).toHaveLength(6);
    // El bbox del suelo (size) sigue siendo el del interior (≈5×4 m).
    expect(scene.floor.size[0]).toBeGreaterThanOrEqual(5);
    expect(scene.floor.size[1]).toBeGreaterThanOrEqual(4);
  });
});
