import { emptyEditorDocument } from '@/lib/editor-document/schema';

export function twoRoomDocument() {
  const doc = emptyEditorDocument();
  doc.vertices = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 3000, y: 0 }, { id: 'c', x: 6000, y: 0 },
    { id: 'd', x: 6000, y: 4000 }, { id: 'e', x: 3000, y: 4000 }, { id: 'f', x: 0, y: 4000 }];
  doc.walls = [['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'e'], ['e', 'f'], ['f', 'a'], ['b', 'e']]
    .map(([a, b], index) => ({ id: `w${index}`, startVertexId: a!, endVertexId: b!, thicknessMm: 150, dimensionalOrigin: 'physical' }));
  return doc;
}
