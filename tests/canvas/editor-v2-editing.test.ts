import { describe, expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addWallPath, addOpening, deleteEntities, moveEntity, shapePoints } from '@/canvas/editor-v2/editing-operations';
import { deriveRooms } from '@/lib/editor-document/rooms';

describe('editor gestures', () => {
  it.each(['L', 'U', 'T'] as const)('creates a valid closed %s room', (shape) => {
    const doc = addWallPath(emptyEditorDocument(), shapePoints(shape, { x: 0, y: 0 }), true);
    expect(deriveRooms(doc)).toHaveLength(1);
  });
  it('preserves original and deletes hosted openings together with wall', () => {
    const original = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 5000, y: 0 }]);
    const doc = addOpening(original, original.walls[0]!.id, { x: 2500, y: 0 }, 'puerta');
    expect(original.openings).toHaveLength(0);
    expect(deleteEntities(doc, [doc.walls[0]!.id]).openings).toHaveLength(0);
  });
  it('moves shared vertices without disconnecting adjacent walls', () => {
    const doc = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 4000 }]);
    const next = moveEntity(doc, doc.walls[0]!.id, { x: 0, y: 200 });
    expect(next.walls[0]!.endVertexId).toBe(next.walls[1]!.startVertexId);
    expect(next.vertices[1]!.y).toBe(200);
  });
});
