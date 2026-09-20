import { describe, expect, it } from 'vitest';
import { emptyEditorDocument, type EditorDocument } from '@/lib/editor-document/schema';
import { planarizeWalls } from '@/lib/editor-document/adapters/planarize-walls';
import { assertPlanarTopology } from '@/lib/editor-document/topology';
import { vertexId } from '@/lib/editor-document/adapters/shared';

function wall(doc: EditorDocument, id: string, a: [number, number], b: [number, number], hidden = false) {
  doc.walls.push({
    id, startVertexId: vertexId(doc, { x: a[0], y: a[1] }), endVertexId: vertexId(doc, { x: b[0], y: b[1] }),
    thicknessMm: 100, dimensionalOrigin: 'physical', ...(hidden ? { hidden: true } : {}),
  });
}

describe('planarizeWalls', () => {
  it('parte una cruz y una T en tramos que comparten vértice, y pasa la validación topológica', () => {
    const doc = emptyEditorDocument();
    wall(doc, 'h', [0, 1000], [4000, 1000]);
    wall(doc, 'v', [2000, 0], [2000, 2000]); // cruz en (2000,1000)
    wall(doc, 't', [3000, 1000], [3000, 3000]); // T sobre h en (3000,1000)
    doc.openings.push({ id: 'o', wallId: 'h', kind: 'puerta', position: 0.25, widthMm: 900, dimensionalOrigin: 'physical' });
    planarizeWalls(doc);
    expect(doc.walls.map((w) => w.id).sort()).toEqual(['h', 'h~2', 'h~3', 't', 'v', 'v~2']);
    expect(() => assertPlanarTopology(doc)).not.toThrow();
    // La puerta estaba en x = 1000 → tramo h [0, 2000], posición 0.5.
    expect(doc.openings[0]).toMatchObject({ wallId: 'h', position: 0.5 });
  });

  it('funde dos muros colineales solapados en tramos únicos, prefiriendo el visible', () => {
    const doc = emptyEditorDocument();
    wall(doc, 'a', [0, 0], [3000, 0]);
    wall(doc, 'b', [2000, 0], [5000, 0], true);
    planarizeWalls(doc);
    const ids = doc.walls.map((w) => w.id).sort();
    expect(ids).toEqual(['a', 'a~2', 'b~2']);
    expect(doc.walls.find((w) => w.id === 'a~2')!.hidden).toBeUndefined();
    expect(() => assertPlanarTopology(doc)).not.toThrow();
  });

  it('descarta un hueco que ya no cabe en su tramo', () => {
    const doc = emptyEditorDocument();
    wall(doc, 'h', [0, 0], [2000, 0]);
    wall(doc, 'v', [500, -500], [500, 500]);
    doc.openings.push({ id: 'o', wallId: 'h', kind: 'ventana', position: 0.1, widthMm: 900, dimensionalOrigin: 'physical' });
    planarizeWalls(doc);
    expect(doc.openings).toEqual([]);
  });
});
