import { expect, it } from 'vitest';
import { addOutdoorEdge } from '@/lib/editor-document/outdoor-area';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { eligibleCeilingRooms } from '@/lib/editor-document/ceiling-geometry';
it('cierra un patio poligonal y conserva tramos abiertos sin techo', () => {
  let doc = emptyEditorDocument();
  const points = [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 2000, y: 4000 }, { x: 0, y: 3000 }, { x: 0, y: 0 }];
  for (let i = 1; i < points.length; i++) {
    doc = addOutdoorEdge(doc, points[i - 1]!, points[i]!);
    expect(doc.walls).toHaveLength(i);
    expect(deriveRooms(doc)).toHaveLength(i === 5 ? 1 : 0);
  }
  expect(eligibleCeilingRooms(doc)).toHaveLength(0);
  expect(doc.walls.every((wall) => wall.hidden)).toBe(true);
});
