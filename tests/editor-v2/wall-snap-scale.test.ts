import { describe, expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { previewVertex } from '@/canvas/editor-v2/vertex-preview';
import { snapWallPoint } from '@/canvas/editor-v2/snap-candidates';
import { addWallSegment } from '@/canvas/editor-v2/wall-draw-machine';
import { snapWallMove } from '@/canvas/editor-v2/wall-move-snap';
import { collisions, snapObject } from '@/canvas/editor-v2/spatial-placement';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { snapSpatialDrag } from '@/components/editor-v2/magnetic-drag';
import { normalizeEditorDocument } from '@/lib/editor-document/document-normalization';
import { upgradeSpatialDocument, localToWorld } from '@/lib/editor-document/spatial-properties';
import { deriveRooms } from '@/lib/editor-document/rooms';
import type { Furniture } from '@/lib/editor-document/schema';

// Casa de 8000×3000 con muros de 150 mm: caras exteriores en x=8075 e y=3075, esquina en (8000,3000).
const house = () => addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 8000, y: 0 }, { x: 8000, y: 3000 }, { x: 0, y: 3000 }], true);
const wallsAt = (doc: ReturnType<typeof house>, x: number, y: number) => {
  const corner = doc.vertices.find((v) => v.x === x && v.y === y);
  return corner ? doc.walls.filter((w) => w.startVertexId === corner.id || w.endVertexId === corner.id).length : 0;
};

describe('arrastrar un vértice suelto hacia una esquina', () => {
  const loose = () => {
    const doc = addWallPath(house(), [{ x: 8600, y: 3600 }, { x: 8600, y: 5000 }], false);
    return { doc, id: doc.vertices.find((v) => v.x === 8600 && v.y === 3600)!.id };
  };
  it.each([
    ['zoom inicial, a 64 mm por fuera', .08, { x: 8040, y: 3050 }],
    ['zoom inicial, a 106 mm en diagonal', .08, { x: 8075, y: 3075 }],
    ['zoom inicial, desde el rincón interior', .08, { x: 7960, y: 2950 }],
    ['zoom alto, a 40 mm', .6, { x: 8030, y: 3026 }],
  ])('%s: se fusiona con la esquina', (_name, scale, pointer) => {
    const { doc, id } = loose();
    const preview = previewVertex(doc, id, pointer, scale, true);
    expect(preview.error).toBeNull();
    expect(preview.point).toEqual({ x: 8000, y: 3000 });
    expect(preview.document.vertices.some((v) => v.id === id)).toBe(false);
    expect(wallsAt(preview.document, 8000, 3000)).toBe(3);
  });
  it('lejos de la esquina, el vértice se alinea con el eje del muro y no con su cara', () => {
    const { doc, id } = loose();
    const preview = previewVertex(doc, id, { x: 8600, y: 3060 }, .08, true);
    expect(preview.point.y).toBe(3000);
  });
});

describe('trazar un muro con el extremo cerca de una esquina', () => {
  it.each([
    ['a 141 mm', .08, { x: 8100, y: 3100 }],
    ['a 149 mm en diagonal, el límite del radio', .08, { x: 8105, y: 3106 }],
  ])('%s: el extremo comparte el vértice de la esquina', (_name, scale, pointer) => {
    const doc = house();
    const snapped = snapWallPoint(doc, pointer, scale, true, { x: 8600, y: 5000 });
    const after = normalizeEditorDocument(addWallSegment(doc, { x: 8600, y: 5000 }, snapped.point));
    expect(after.vertices).toHaveLength(5);
    expect(wallsAt(after, 8000, 3000)).toBe(3);
  });
  it('el extremo sobre el cuerpo de un muro lo une en T', () => {
    const doc = house();
    const snapped = snapWallPoint(doc, { x: 4000, y: 3060 }, .08, true, { x: 4000, y: 5000 });
    expect(snapped.point).toEqual({ x: 4000, y: 3000 });
    const after = addWallSegment(doc, { x: 4000, y: 5000 }, snapped.point);
    expect(after.vertices.filter((v) => v.y === 3000)).toHaveLength(3);
  });
  it('un extremo trazado a un palmo de la esquina, sobre la prolongación del muro, se une a ella al normalizar', () => {
    const after = normalizeEditorDocument(addWallSegment(house(), { x: 8600, y: 5000 }, { x: 8120, y: 3000 }));
    expect(wallsAt(after, 8000, 3000)).toBe(3);
    expect(normalizeEditorDocument(after)).toBe(after);
  });
  it('un tabique que llega a la cara de la fachada a 12 cm de la esquina sobrevive intacto a la normalización', () => {
    const doc = addWallSegment(house(), { x: 7860, y: 1000 }, { x: 7860, y: 2925 });
    const after = normalizeEditorDocument(doc);
    expect(after.vertices.some((v) => v.x === 7860 && v.y === 2925)).toBe(true);
    expect(after.vertices.some((v) => v.x === 7860 && v.y === 1000)).toBe(true);
    expect(after.walls).toHaveLength(5);
    expect(wallsAt(after, 8000, 3000)).toBe(2);
  });
});

describe('límites del imán al arrastrar un vértice', () => {
  it('la unión en T conserva su holgura física: a 30 cm del muro no se une', () => {
    const doc = addWallPath(house(), [{ x: 4000, y: 3600 }, { x: 4000, y: 5000 }], false);
    const id = doc.vertices.find((v) => v.x === 4000 && v.y === 3600)!.id;
    const preview = previewVertex(doc, id, { x: 4000, y: 3300 }, .08, true);
    expect(preview.point).toEqual({ x: 4000, y: 3300 });
    expect(preview.document.vertices.filter((v) => v.y === 3000)).toHaveLength(2);
  });
  it('un vértice huérfano no se fusiona consigo mismo', () => {
    const doc = house();
    doc.vertices.push({ id: 'orphan', x: 5000, y: 5000 });
    expect(() => previewVertex(doc, 'orphan', { x: 5010, y: 5010 }, .08, true)).not.toThrow();
  });
});

describe('mover un muro entero', () => {
  it('queda sobre el eje del otro muro, nunca sobre su cara', () => {
    const doc = addWallPath(house(), [{ x: 9000, y: 3300 }, { x: 12000, y: 3300 }], false);
    const wall = doc.walls.find((w) => doc.vertices.find((v) => v.id === w.startVertexId)!.x >= 9000)!;
    for (const dy of [-260, -300, -360, -400]) expect(3300 + snapWallMove(doc, wall, { x: 0, y: dy }, .08, true).delta.y).toBe(3000);
  });
  it('las guías describen la posición final aunque un eje venga de la rejilla', () => {
    const doc = addWallPath(house(), [{ x: 9000, y: 3300 }, { x: 12000, y: 3300 }], false);
    const wall = doc.walls.find((w) => doc.vertices.find((v) => v.id === w.startVertexId)!.x >= 9000)!;
    const result = snapWallMove(doc, wall, { x: 1234, y: -300 }, .08, true);
    expect(result.delta).toEqual({ x: 1200, y: -300 });
    expect(result.guides).toHaveLength(1);
    expect(result.guides[0]!.from.y).toBe(3000);
  });
  it('sin referencia cerca cae en la rejilla de 10 cm', () => {
    const doc = addWallPath(house(), [{ x: 9000, y: 3300 }, { x: 12000, y: 3300 }], false);
    const wall = doc.walls.find((w) => doc.vertices.find((v) => v.id === w.startVertexId)!.x >= 9000)!;
    expect(snapWallMove(doc, wall, { x: 0, y: 1234 }, .08, true).delta).toEqual({ x: 0, y: 1200 });
  });
});

describe('los muebles conservan el pegado a caras', () => {
  it('un mueble soltado en el rincón interior queda contra ambas caras', () => {
    const doc = upgradeSpatialDocument(house());
    const item = { id: 'f1', kind: 'sofa', catalogId: 'builtin:sofa', x: 7300, y: 2300, widthMm: 600, depthMm: 600, rotation: 0, heightMm: 800, elevationMm: 0, dimensionalOrigin: 'physical' } as Furniture;
    const placed = snapObject(doc, item, .08, true);
    const corners = [{ x: 0, y: 0 }, { x: 600, y: 0 }, { x: 600, y: 600 }, { x: 0, y: 600 }].map((p) => localToWorld(placed, p));
    expect(Math.max(...corners.map((p) => p.x))).toBeCloseTo(7925, 6);
    expect(Math.max(...corners.map((p) => p.y))).toBeCloseTo(2925, 6);
    expect(deriveRooms(doc)).toHaveLength(1);
  });

  it('mantiene horizontal un mueble arrastrado al rincón sin saltos ni colisiones', () => {
    const doc = upgradeSpatialDocument(house()), store = createEditorStore(doc);
    const furniture = { id: 'sofa', kind: 'sofa', catalogId: 'builtin:sofa', x: 6000, y: 2000,
      widthMm: 1800, depthMm: 800, rotation: 0, heightMm: 900, elevationMm: 0,
      dimensionalOrigin: 'physical' } as Furniture;
    for (const [x, y] of [[5950, 1850], [6000, 1950], [6050, 2000], [6100, 2050]] as const) {
      const preview = snapSpatialDrag(store, { ...furniture, x, y }, .08) as Furniture;
      const dropped = snapObject(doc, preview, .08, true, { preserveRotation: true }) as Furniture;
      expect(dropped).toMatchObject({ x: 6125, y: 2125, rotation: 0 });
      expect(preview).toEqual(dropped);
      expect([...collisions({ ...doc, furniture: [dropped] }).keys()]).toEqual([]);
    }
  });
});
