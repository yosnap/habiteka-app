import { describe, expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { exteriorWallIds, interiorWallIds, setWallClassification, wallClassificationInfo } from '@/lib/editor-document/exterior-wall-selection';
import { parseEditorDocument } from '@/lib/editor-document/validation';
import { selectedWallSides } from '@/lib/editor-document/wall-bulk-appearance';
import { editorDocumentToScene } from '@/canvas/editor-v2/scene/editor-document-to-scene';
import { wallFaces } from '@/lib/editor-document/wall-faces';
import { applyKindSelection, idsByKind } from '@/canvas/editor-v2/select-by-kind';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { bulkPeers, propagateToPeers } from '@/lib/editor-document/bulk-edit';

function house() {
  const doc = emptyEditorDocument();
  doc.vertices = [
    { id: 'a', x: 0, y: 0 }, { id: 'b', x: 3000, y: 0 }, { id: 'c', x: 6000, y: 0 },
    { id: 'd', x: 6000, y: 4000 }, { id: 'e', x: 3000, y: 4000 }, { id: 'f', x: 0, y: 4000 },
  ];
  doc.walls = [
    ['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'e'], ['e', 'f'], ['f', 'a'], ['b', 'e'],
  ].map(([a, b], i) => ({
    id: `w${i}`, startVertexId: a!, endVertexId: b!, thicknessMm: 150, dimensionalOrigin: 'physical' as const,
  }));
  return doc;
}

describe('selector de muros exteriores', () => {
  it('la clasificación manual manda en selección, caras y corte 3D, y se puede volver a automática', () => {
    const before = house(), changed = setWallClassification(before, ['w0', 'w1'], 'interior');
    expect(exteriorWallIds(changed)).not.toContain('w0');
    expect(interiorWallIds(changed)).toContain('w0');
    expect(selectedWallSides(changed, 'w0', 'interior')).toEqual(['left', 'right']);
    expect(wallFaces(changed, changed.walls[0]!).every(face => face.label.startsWith('Interior'))).toBe(true);
    const facade = setWallClassification(before, ['w6'], 'exterior');
    const face = selectedWallSides(facade, 'w6', 'exterior')[0];
    expect(wallFaces(facade, facade.walls[6]!).find(item => item.side === face)!.label).toBe('Exterior');
    const normals = editorDocumentToScene(facade).exteriorWalls.filter(item => item.sourceEntityId === 'w6');
    expect(normals).toHaveLength(1);
    expect(normals[0]!.normalX).toBe(face === 'left' ? -1 : 1);
    expect(editorDocumentToScene(changed).exteriorWalls.some(wall => wall.sourceEntityId === 'w0')).toBe(false);
    expect(wallClassificationInfo(changed, changed.walls[0]!)).toMatchObject({ effective: 'interior', automatic: 'exterior' });
    expect(parseEditorDocument(JSON.parse(JSON.stringify(changed))).walls[0]!.classification).toBe('interior');
    expect(setWallClassification(changed, ['w0'], 'auto').walls[0]!.classification).toBeUndefined();
    expect(before.walls[0]!.classification).toBeUndefined();
    expect(changed.vertices).toEqual(before.vertices);
    const store = createEditorStore(before);
    store.getState().apply(changed); store.getState().undo();
    expect(exteriorWallIds(store.getState().document)).toContain('w0');
  });
  it('incluye el perímetro de dos habitaciones sin seleccionar el tabique compartido', () => {
    expect(exteriorWallIds(house())).toEqual(['w0', 'w1', 'w2', 'w3', 'w4', 'w5']);
    expect(interiorWallIds(house())).toEqual(['w6']);
    expect(idsByKind(house(), [], 'exterior-walls')).toEqual(exteriorWallIds(house()));
    expect(idsByKind(house(), [], 'interior-walls')).toEqual(['w6']);
  });

  it('incluye la fachada compartida con un patio lógico y excluye los límites invisibles', () => {
    const doc = house();
    doc.vertices.push({ id: 'g', x: 6000, y: 6000 }, { id: 'h', x: 0, y: 6000 });
    doc.walls.push(...([
      ['d', 'g'], ['g', 'h'], ['h', 'f'],
    ] as const).map(([a, b], i) => ({
      id: `hidden:patio:${i}`, startVertexId: a, endVertexId: b,
      thicknessMm: 80, dimensionalOrigin: 'physical' as const, hidden: true,
    })));
    expect(exteriorWallIds(doc)).toEqual(['w0', 'w1', 'w2', 'w3', 'w4', 'w5']);
    expect(interiorWallIds(doc)).toEqual(['w6']);
  });

  it('permite cambiar el grosor de toda la fachada sin tocar el tabique', () => {
    const before = house(), ids = exteriorWallIds(before);
    const after = structuredClone(before);
    after.walls.find((wall) => wall.id === ids[0])!.thicknessMm = 250;
    const result = propagateToPeers(before, after, ids[0]!, bulkPeers(before, ids[0]!, ids));
    expect(result.walls.filter((wall) => ids.includes(wall.id)).every((wall) => wall.thicknessMm === 250)).toBe(true);
    expect(result.walls.find((wall) => wall.id === 'w6')!.thicknessMm).toBe(150);
  });

  it('abre Propiedades con la selección de fachadas desde el menú superior', () => {
    const store = createEditorStore(house());
    const ids = idsByKind(store.getState().document, [], 'exterior-walls');
    store.getState().setDetailPanel('paint');
    applyKindSelection(store, 'exterior-walls', ids);
    expect(store.getState().selection).toEqual(ids);
    expect(store.getState().sidePanel).toBe('inspector');
    expect(store.getState().detailPanel).toBeNull();
  });
});
