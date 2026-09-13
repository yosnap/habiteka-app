import { describe, expect, it } from 'vitest';
import { addRamp } from '@/lib/editor-document/construction-commands';
import { emptyEditorDocument, type Ramp } from '@/lib/editor-document/schema';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { floorFinish, setFloorFinish } from '@/lib/editor-document/floor-finishes';
import { editorDocumentToScene } from '@/canvas/editor-v2/scene/editor-document-to-scene';

function closedRoom() {
  const doc = emptyEditorDocument();
  doc.vertices = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 6000, y: 0 }, { id: 'c', x: 6000, y: 6000 }, { id: 'd', x: 0, y: 6000 }];
  doc.walls = ([['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'a']] as const).map(([startVertexId, endVertexId], index) => ({
    id: `wall-${index}`, startVertexId, endVertexId, thicknessMm: 150, dimensionalOrigin: 'physical' as const,
  }));
  return doc;
}

const arrivalRamp: Ramp = { id: 'ramp', catalogId: 'builtin:ramp-straight', x: 3600, y: 0,
  widthMm: 1200, depthMm: 4000, riseMm: 1200, elevationMm: 0, rotation: 180, materialId: 'concrete-grey' };

describe('ramp arrival', () => {
  it('raises the entered floor and creates a matching wall opening automatically', () => {
    const connected = addRamp(closedRoom(), arrivalRamp);
    const opening = connected.openings.find((item) => item.sourceRampId === arrivalRamp.id)!;
    const room = deriveRooms(connected)[0]!;
    expect(opening).toMatchObject({ kind: 'hueco', wallId: 'wall-0', widthMm: 1200, elevationMm: 1200, heightMm: 2700 });
    expect(floorFinish(connected, room.id).elevationMm).toBe(1200);
    const floor = editorDocumentToScene(connected).polygons.find((polygon) => polygon.sourceEntityId === room.id)!;
    expect(floor.elevation + floor.height).toBe(1.2);
    expect(floor.height).toBe(1.2);
    const wall = editorDocumentToScene(connected).boxes.find((box) => box.sourceEntityId === 'wall-0')!;
    expect(wall.position[1] - wall.size[1] / 2).toBeCloseTo(1.2);
    expect(wall.position[1] + wall.size[1] / 2).toBeCloseTo(3.9);
    expect(setFloorFinish(connected, room.id, { elevationMm: 1300 }).schemaVersion).toBe(6);
  });
  it('uses the final elevation of the second flight for its arrival opening', () => {
    const routed: Ramp = { ...arrivalRamp, id: 'routed', x: 2400, y: -4200, rotation: 90,
      route: { landingMm: 1200, turn: 'right', secondDepthMm: 3000, secondRiseMm: 600 } };
    const connected = addRamp(closedRoom(), routed);
    const opening = connected.openings.find((item) => item.sourceRampId === routed.id)!;
    const room = deriveRooms(connected)[0]!;
    expect(opening).toMatchObject({ wallId: 'wall-0', elevationMm: 1800, heightMm: 2700 });
    expect(floorFinish(connected, room.id).elevationMm).toBe(1800);
    const floor = editorDocumentToScene(connected).polygons.find((polygon) => polygon.sourceEntityId === room.id)!;
    const ramps = editorDocumentToScene(connected).ramps.filter((ramp) => ramp.sourceEntityId === routed.id);
    expect(ramps[1]!.position[1]).toBe(0);
    expect(ramps[1]!.baseHeight).toBe(1.2);
    expect(ramps[2]!.position[1] + ramps[2]!.baseHeight + ramps[2]!.rise).toBeCloseTo(floor.elevation + floor.height);
  });
  it('cuts the crossed wall and floor access when a final flight finishes inside its room', () => {
    const insideRoom: Ramp = { ...arrivalRamp, id: 'inside-room', x: 2400, y: 3000, rotation: 0, depthMm: 4000 };
    const connected = addRamp(closedRoom(), insideRoom);
    const opening = connected.openings.find((item) => item.sourceRampId === insideRoom.id)!;
    expect(opening.wallId).toBe('wall-2');
    const floors = editorDocumentToScene(connected).polygons.filter((polygon) => polygon.role === 'floor');
    expect(floors).toHaveLength(1);
    expect(floors[0]!.points.length).toBeGreaterThan(4);
  });
});
