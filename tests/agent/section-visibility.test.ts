import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { sectionVisibility, sectionPointVisible, sectionWallSegments } from '@/server/agent/editor-v2/section-visibility';
import { rasterizeEditorElevation, sectionFurnitureDescription, sectionRooms } from '@/server/agent/editor-v2/rasterize-editor-elevation';
import { setWallCurve } from '@/lib/editor-document/curve-commands';

function steppedPlan() {
  let doc = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 8000, y: 0 }, { x: 8000, y: 4000 },
    { x: 2000, y: 4000 }, { x: 2000, y: 6000 }, { x: 0, y: 6000 }], true);
  doc = addWallPath(doc, [{ x: 2000, y: 0 }, { x: 2000, y: 4000 }]);
  doc.labels = [{ id: 'garage', x: 1000, y: 1000, text: 'Garaje' }, { id: 'salon', x: 5000, y: 1000, text: 'Salón' }];
  doc.furniture = [{ id: 'car', name: 'Vehículo oculto', kind: 'coche', x: 500, y: 800, widthMm: 1000, depthMm: 2500,
    rotation: 0, dimensionalOrigin: 'physical' }];
  return doc;
}
describe('visibilidad de una sección abierta con retranqueos', () => {
  it('los puntos adicionales de un muro curvo mantienen su procedencia y la estancia abierta', () => {
    const doc = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 5000 }, { x: 0, y: 5000 }], true);
    const curved = setWallCurve(doc, doc.walls[0]!.id, -500);
    expect(sectionRooms(curved, 'right')).toHaveLength(1);
    expect(sectionPointVisible(sectionVisibility(curved, 'right'), { x: 2500, y: 2500 })).toBe(true);
  });
  it('una cochera abierta parcialmente no lleva su coche detrás del salón al primer plano', () => {
    const doc = steppedPlan(), layout = sectionVisibility(doc, 'right');
    expect(sectionPointVisible(layout, { x: 1000, y: 2000 })).toBe(false);
    expect(sectionPointVisible(layout, { x: 1000, y: 5000 })).toBe(true);
    expect(sectionPointVisible(layout, { x: 5000, y: 2000 })).toBe(true);
    const rooms = sectionRooms(doc, 'right');
    expect(rooms.map(room => room.name)).toEqual(['Garaje', 'Salón']);
    expect(rooms[0]!.visibilityHint).toContain('0–33 %');
    expect(sectionFurnitureDescription(doc, 'right', rooms).join(' ')).not.toContain('Vehículo oculto');
    expect(sectionWallSegments(layout, { x: 0, y: 0 }, { x: 0, y: 6000 }, 100))
      .toEqual([[{ x: 0, y: 6000 }, { x: 0, y: 4000 }]]);
  });
  it('la sección arquitectónica del diseño aceptado no impone muebles del plano', async () => {
    const doc = steppedPlan();
    const architecture = await rasterizeEditorElevation(doc, 'front', { cut: true, furniture: false });
    const empty = await rasterizeEditorElevation({ ...doc, furniture: [] }, 'front', { cut: true, furniture: false });
    expect(architecture!.base64).toBe(empty!.base64);
    const drawn = await rasterizeEditorElevation(doc, 'front', { cut: true });
    const pixels = await sharp(Buffer.from(drawn!.base64, 'base64')).stats();
    expect(pixels.channels[0]!.stdev).toBeGreaterThan(0);
    expect(drawn!.base64).not.toBe(architecture!.base64);
  });
  it('un límite oculto no es una pared y tampoco autoriza retirar el tabique del recinto que queda detrás', () => {
    const doc = steppedPlan(), vertices = new Map(doc.vertices.map(v => [v.id, v]));
    const frontWall = doc.walls.find(wall => vertices.get(wall.startVertexId)!.x === 8000 && vertices.get(wall.endVertexId)!.x === 8000)!;
    frontWall.hidden = true;
    const layout = sectionVisibility(doc, 'right');
    expect(sectionPointVisible(layout, { x: 1000, y: 2000 })).toBe(false);
    expect(sectionRooms(doc, 'right').map(room => room.name)).toEqual(['Garaje']);
  });
});
