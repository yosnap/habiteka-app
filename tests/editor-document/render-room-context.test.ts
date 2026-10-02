import { describe, expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { roomInteriorCameras } from '@/lib/editor-document/room-interior-cameras';
import { renderRoomContext } from '@/lib/editor-document/render-room-context';
import type { RenderView } from '@/lib/editor-document/render-view';

function fixture() {
  const doc = emptyEditorDocument();
  doc.vertices = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 6000, y: 0 },
    { id: 'c', x: 6000, y: 4000 }, { id: 'd', x: 0, y: 4000 }];
  doc.walls = doc.vertices.map((v, i) => ({ id: `w${i}`, startVertexId: v.id,
    endVertexId: doc.vertices[(i + 1) % 4]!.id, thicknessMm: 150, dimensionalOrigin: 'physical' }));
  doc.labels = [{ id: 'label', x: 3000, y: 2000, text: 'Salón-cocina' }];
  const polygon = (left: number, right: number) => [{ x: left, y: 100 }, { x: right, y: 100 },
    { x: right, y: 3900 }, { x: left, y: 3900 }];
  doc.designZones = [{ id: 'salon', name: 'Salón', polygon: polygon(100, 2900) },
    { id: 'cocina', name: 'Cocina', polygon: polygon(3000, 5900) },
    { id: 'patio', name: 'Patio', polygon: polygon(5800, 9000) }];
  const camera = roomInteriorCameras(doc)[0]!;
  const view: RenderView = { preset: 'custom', position: camera.camera.position, levelId: camera.camera.levelId,
    focus: camera.camera.focus,
    quaternion: [0, 0, 0, 1], fov: camera.camera.fovDeg, aspect: 1.6, allLevels: false, cutaway: false };
  return { doc, view, camera };
}

describe('identidad de vistas interiores', () => {
  it('identifica la estancia y sus dos zonas sin atribuir el patio contiguo', () => {
    const { doc, view, camera } = fixture();
    expect(renderRoomContext(doc, view)).toMatchObject({ roomId: camera.roomId, roomName: 'Salón-cocina',
      zones: [{ id: 'salon', name: 'Salón' }, { id: 'cocina', name: 'Cocina' }] });
  });
  it('no atribuye una estancia por cercanía en una vista aérea o en otra planta', () => {
    const { doc, view } = fixture();
    expect(renderRoomContext(doc, { ...view, preset: 'top' })).toBeNull();
    expect(renderRoomContext(doc, { ...view, levelId: 'otro' })).toBeNull();
    expect(renderRoomContext(doc, { ...view, position: [view.position[0], 20, view.position[2]] })).toBeNull();
    expect(renderRoomContext(doc, { ...view, focus: [view.position[0] + 10, 1.6, view.position[2]] })).toBeNull();
  });
});
