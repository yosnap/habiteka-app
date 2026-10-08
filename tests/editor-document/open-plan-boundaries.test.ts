/**
 * Planta abierta: una cocina leída sin muro hacia el comedor sigue siendo su propia
 * estancia en el editor gracias a un límite oculto en el eje de los muros.
 */
import { describe, expect, it } from 'vitest';
import type { PlanImportResult, PlanWall } from '@/lib/contracts';
import { fromPlanImport } from '@/lib/editor-document/adapters/plano2d-import';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { eligibleCeilingRooms } from '@/lib/editor-document/ceiling-geometry';
import { selectedWallSides } from '@/lib/editor-document/wall-bulk-appearance';
import { wallPoints } from '@/lib/editor-document/geometry';

const T = 160;
const wall = (id: string, x1: number, y1: number, x2: number, y2: number): PlanWall =>
  ({ id, from: { x: x1, y: y1 }, to: { x: x2, y: y2 }, thicknessMm: T });

// Caja de 6 × 6 m: cocina arriba (0–2,5 m) abierta al comedor, sin muro entre ellas.
const walls = [wall('n', 0, 0, 6000, 0), wall('s', 0, 6000, 6000, 6000), wall('w', 0, 0, 0, 6000), wall('e', 6000, 0, 6000, 6000)];

function result(withKitchenZone: boolean): PlanImportResult {
  const zones = [
    { id: 'comedor', name: 'Comedor', walls, apertures: [], dimensions: [],
      outline: withKitchenZone ? [{ x: 80, y: 2580 }, { x: 5920, y: 2580 }, { x: 5920, y: 5920 }, { x: 80, y: 5920 }]
        : [{ x: 80, y: 80 }, { x: 5920, y: 80 }, { x: 5920, y: 5920 }, { x: 80, y: 5920 }] },
    ...(withKitchenZone ? [{ id: 'cocina', name: 'Cocina', walls: [], apertures: [], dimensions: [],
      outline: [{ x: 80, y: 80 }, { x: 5920, y: 80 }, { x: 5920, y: 2500 }, { x: 80, y: 2500 }] }] : []),
  ];
  return { plano: { schemaVersion: 1, zones }, escalaEstimada: false, writtenDimensions: [], corrections: [],
    exteriors: [], furniture: [], warnings: [] } as unknown as PlanImportResult;
}

const area = (points: Array<{ x: number; y: number }>) =>
  Math.abs(points.reduce((sum, p, i) => { const q = points[(i + 1) % points.length]!; return sum + p.x * q.y - q.x * p.y; }, 0)) / 2e6;

describe('límites ocultos de planta abierta', () => {
  it('separa la cocina abierta del comedor con un muro oculto', () => {
    const { document } = fromPlanImport(result(true));
    const rooms = deriveRooms(document!);
    expect(rooms).toHaveLength(2);
    const hidden = document!.walls.filter((item) => item.id.startsWith('hidden:open'));
    expect(hidden.length).toBeGreaterThan(0);
    expect(hidden.every((item) => item.hidden)).toBe(true);
    const areas = rooms.map((room) => area(room.boundary)).sort((a, b) => a - b);
    // La cocina queda en torno a sus 6 × 2,5 m leídos; el resto es el comedor.
    expect(areas[0]).toBeGreaterThan(13);
    expect(areas[0]).toBeLessThan(17);
  });

  it('no añade nada cuando la estancia leída ya está cerrada por muros', () => {
    const { document } = fromPlanImport(result(false));
    expect(document!.walls.some((item) => item.id.startsWith('hidden:open'))).toBe(false);
    expect(deriveRooms(document!)).toHaveLength(1);
  });

  it('una estancia separada con límite de planta abierta es interior y su fachada se pinta por fuera', () => {
    const doc = fromPlanImport(result(true)).document!;
    expect(eligibleCeilingRooms(doc)).toHaveLength(2);
    // Muro norte (y = 0): la cara exterior es la que mira a y < 0.
    const north = doc.walls.find((item) => { const [a, b] = wallPoints(doc, item); return !item.hidden && a.y === 0 && b.y === 0; })!;
    const [a, b] = wallPoints(doc, north);
    const [outside] = selectedWallSides(doc, north.id, 'exterior');
    // La izquierda de un muro es el lado a la izquierda de su sentido de inicio a fin.
    const leftNormalY = b.x - a.x;
    expect(outside === 'left' ? leftNormalY : -leftNormalY).toBeLessThan(0);
  });
});
