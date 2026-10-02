import { describe, expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { exteriorWallIds, interiorWallIds } from '@/lib/editor-document/exterior-wall-selection';
import { selectedWallSides, updateSelectedWallFaces } from '@/lib/editor-document/wall-bulk-appearance';

function houseWithPatio() {
  const doc = emptyEditorDocument();
  doc.vertices = [
    { id: 'a', x: 0, y: 0 }, { id: 'b', x: 3000, y: 0 }, { id: 'c', x: 6000, y: 0 },
    { id: 'd', x: 6000, y: 4000 }, { id: 'e', x: 3000, y: 4000 }, { id: 'f', x: 0, y: 4000 },
    { id: 'g', x: 6000, y: 6000 }, { id: 'h', x: 0, y: 6000 },
  ];
  doc.walls = [
    ['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'e'], ['e', 'f'], ['f', 'a'], ['b', 'e'],
  ].map(([a, b], i) => ({
    id: `w${i}`, startVertexId: a!, endVertexId: b!, thicknessMm: 150, dimensionalOrigin: 'physical' as const,
  }));
  doc.walls.push(...([
    ['d', 'g'], ['g', 'h'], ['h', 'f'],
  ] as const).map(([a, b], i) => ({
    id: `hidden:patio:${i}`, startVertexId: a, endVertexId: b, thicknessMm: 80,
    dimensionalOrigin: 'physical' as const, hidden: true,
  })));
  return doc;
}

describe('acabados en bloque por cara de fachada', () => {
  it('pinta la cara exterior e interior de cada fachada, incluida la compartida con el patio', () => {
    const source = houseWithPatio(), ids = exteriorWallIds(source);
    const outer = updateSelectedWallFaces(source, ids, 'exterior', { color: '#aabbcc' });
    const result = updateSelectedWallFaces(outer, ids, 'interior', { color: '#112233' });
    for (const id of ids) {
      const wall = result.walls.find((item) => item.id === id)!;
      expect(wall.colors?.[selectedWallSides(result, id, 'exterior')[0]!]).toBe('#aabbcc');
      expect(wall.colors?.[selectedWallSides(result, id, 'interior')[0]!]).toBe('#112233');
    }
    expect(selectedWallSides(result, 'w3', 'exterior')).toHaveLength(1);
    expect(result.walls.find((item) => item.id === 'w6')!.colors).toEqual({
      left: '#eeeae2', right: '#eeeae2',
    });
  });

  it('aplica ambas caras y material solo a los tabiques seleccionados', () => {
    const source = houseWithPatio(), ids = interiorWallIds(source);
    expect(ids).toEqual(['w6']);
    const painted = updateSelectedWallFaces(source, ids, 'both', { color: '#334455' });
    const result = updateSelectedWallFaces(painted, ids, 'both', { materialId: 'polyhaven:wood_floor' });
    expect(result.walls.find((item) => item.id === 'w6')!.materials).toEqual({
      left: 'polyhaven:wood_floor', right: 'polyhaven:wood_floor',
    });
    expect(result.walls.find((item) => item.id === 'w0')!.materials).toEqual({
      left: 'plaster-white', right: 'plaster-white',
    });
  });

  it('pinta el interior de fachadas y tabiques en una selección mixta sin cambiar fachadas exteriores', () => {
    const source = houseWithPatio(), ids = [...exteriorWallIds(source).slice(0, 2), 'w6'];
    const result = updateSelectedWallFaces(source, ids, 'interior', { color: '#547a69' });
    for (const id of ids.slice(0, 2)) {
      const inside = selectedWallSides(result, id, 'interior')[0]!;
      const outside = selectedWallSides(result, id, 'exterior')[0]!;
      const wall = result.walls.find((item) => item.id === id)!;
      expect(wall.colors?.[inside]).toBe('#547a69');
      expect(wall.colors?.[outside]).toBe('#eeeae2');
    }
    expect(result.walls.find((item) => item.id === 'w6')!.colors).toEqual({ left: '#547a69', right: '#547a69' });
  });
});
