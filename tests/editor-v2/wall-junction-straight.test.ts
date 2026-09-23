import { describe, expect, it } from 'vitest';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { junctionMeshes } from '@/canvas/editor-v2/scene/wall-meshes';

describe('uniones de muros en 3D', () => {
  it('dos tramos alineados forman una pared continua, sin pieza de unión', () => {
    const doc = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 2000, y: 0 }, { x: 5000, y: 0 }], false);
    expect(doc.walls).toHaveLength(2);
    expect(junctionMeshes(doc)).toEqual([]);
  });
  it('una esquina sí lleva su pieza de unión', () => {
    const doc = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 3000, y: 0 }, { x: 3000, y: 3000 }], false);
    expect(junctionMeshes(doc).length).toBeGreaterThan(0);
  });
});
