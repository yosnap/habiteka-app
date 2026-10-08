/**
 * Dibujar paredes que cruzan otras o acaban en límites ocultos: el editor divide
 * los muros y comparte vértice, en lugar de rechazar el plano por un cruce.
 */
import { describe, expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { deriveRooms } from '@/lib/editor-document/rooms';

const box = () => addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 6000, y: 0 }, { x: 6000, y: 4000 }, { x: 0, y: 4000 }], true);

describe('dibujar paredes que cruzan otras', () => {
  it('una pared que cruza otra por el medio divide ambas en un vértice común', () => {
    const split = addWallPath(box(), [{ x: 3000, y: 0 }, { x: 3000, y: 4000 }]);
    const crossed = addWallPath(split, [{ x: 0, y: 2000 }, { x: 6000, y: 2000 }]);
    expect(deriveRooms(crossed)).toHaveLength(4);
    const center = crossed.vertices.filter((v) => v.x === 3000 && v.y === 2000);
    expect(center).toHaveLength(1);
    expect(crossed.walls.filter((w) => w.startVertexId === center[0]!.id || w.endVertexId === center[0]!.id)).toHaveLength(4);
  });

  it('una pared que acaba sobre un límite oculto lo divide y cierra la estancia', () => {
    const doc = box();
    // Límite oculto que separa en dos la caja, como el de una cocina abierta.
    const withHidden = addWallPath(doc, [{ x: 0, y: 2000 }, { x: 6000, y: 2000 }]);
    const hiddenId = withHidden.walls.find((w) => {
      const a = withHidden.vertices.find((v) => v.id === w.startVertexId)!, b = withHidden.vertices.find((v) => v.id === w.endVertexId)!;
      return a.y === 2000 && b.y === 2000;
    })!.id;
    withHidden.walls = withHidden.walls.map((w) => (w.id === hiddenId ? { ...w, hidden: true } : w));
    const drawn = addWallPath(withHidden, [{ x: 3000, y: 0 }, { x: 3000, y: 2000 }]);
    expect(deriveRooms(drawn)).toHaveLength(3);
    expect(drawn.walls.filter((w) => w.hidden)).toHaveLength(2);
  });
});
