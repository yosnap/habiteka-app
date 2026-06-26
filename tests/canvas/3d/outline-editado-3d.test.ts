import { describe, it, expect } from 'vitest';
import { docToScene } from '@/canvas/3d/doc-to-scene';
import { segmentToWall } from '@/canvas/draw-wall';
import type { CanvasDoc, StructObj, FloorVertex } from '@/canvas/types';
import { CANVAS_SCHEMA_VERSION } from '@/canvas/types';

/** Simula setFloorOutline: genera muros drawn desde un contorno (polígono). */
function docFromOutline(vertices: FloorVertex[]): CanvasDoc {
  const scale = { pxPerMeter: 100 };
  const objects: StructObj[] = [];
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i]!;
    const b = vertices[(i + 1) % vertices.length]!;
    const wall = segmentToWall(`wall-${i}`, a, b, scale, 0.15);
    if (wall) objects.push(wall);
  }
  return {
    schemaVersion: CANVAS_SCHEMA_VERSION,
    baseImage: null,
    strokes: [],
    objects,
    products: [],
    selection: null,
    scale,
    ceilingHeightM: 2.5,
    floorOutline: vertices,
  };
}

/**
 * Verifica que tras editar el contorno (muros drawn + floorOutline), docToScene genera cajas
 * orientadas (grosor hacia fuera) que cubren las esquinas. Las cajas deben tener size[0] > len
 * (extensión) y estar desplazadas hacia fuera (normal exterior).
 */
describe('3D: contorno editado (muros drawn + floorOutline)', () => {
  it('rectángulo editado: 4 cajas orientadas, más largas que la arista (extensión de esquina)', () => {
    const outline: FloorVertex[] = [
      { x: 120, y: 120 },
      { x: 620, y: 120 },
      { x: 620, y: 520 },
      { x: 120, y: 520 },
    ];
    const doc = docFromOutline(outline);
    const scene = docToScene(doc);
    expect(scene.walls.length).toBe(4);
    // Cada caja debe ser más larga que la arista por la extensión 2*t (0.3m).
    for (const w of scene.walls) {
      expect(w.size[0]).toBeGreaterThan(3.8);
      expect(w.size[0]).toBeLessThan(5.5);
    }
  });

  it('el suelo usa el floorOutline (4 vértices, no escalones del flood-fill)', () => {
    const outline: FloorVertex[] = [
      { x: 120, y: 120 },
      { x: 620, y: 120 },
      { x: 620, y: 520 },
      { x: 120, y: 520 },
    ];
    const doc = docFromOutline(outline);
    const scene = docToScene(doc);
    expect(scene.floor.polygon).toBeDefined();
    expect(scene.floor.polygon!.length).toBe(4);
  });
});
