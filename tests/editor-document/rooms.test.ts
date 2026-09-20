import { describe, expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { deriveRooms } from '@/lib/editor-document/rooms';

function twoRooms() {
  const doc = emptyEditorDocument();
  doc.vertices = [
    { id: 'a', x: 0, y: 0 },
    { id: 'b', x: 3000, y: 0 },
    { id: 'c', x: 6000, y: 0 },
    { id: 'd', x: 6000, y: 4000 },
    { id: 'e', x: 3000, y: 4000 },
    { id: 'f', x: 0, y: 4000 },
  ];
  doc.walls = [
    ['a', 'b'],
    ['b', 'c'],
    ['c', 'd'],
    ['d', 'e'],
    ['e', 'f'],
    ['f', 'a'],
    ['b', 'e'],
  ].map(([a, b], i) => ({
    id: `w${i}`,
    startVertexId: a!,
    endVertexId: b!,
    thicknessMm: 150,
    dimensionalOrigin: 'physical',
  }));
  return doc;
}
describe('bounded planar faces', () => {
  it('finds two adjacent rooms, not their outer combined cycle', () => {
    const rooms = deriveRooms(twoRooms());
    expect(rooms).toHaveLength(2);
    expect(rooms.map((r) => r.areaMm2)).toEqual([12_000_000, 12_000_000]);
    expect(rooms.every((r) => r.wallIds.includes('w6'))).toBe(true);
  });
  it('ignores a dangling wall inside a room', () => {
    const doc = twoRooms();
    doc.vertices.push({ id: 'tip', x: 1000, y: 1000 });
    doc.walls.push({
      id: 'spur',
      startVertexId: 'a',
      endVertexId: 'tip',
      thicknessMm: 100,
      dimensionalOrigin: 'physical',
    });
    expect(deriveRooms(doc).map((r) => r.areaMm2)).toEqual([12_000_000, 12_000_000]);
  });
  it('is stable when wall direction and insertion order change', () => {
    const doc = twoRooms();
    const before = deriveRooms(doc);
    doc.walls.reverse().forEach((w) => {
      [w.startVertexId, w.endVertexId] = [w.endVertexId, w.startVertexId];
    });
    expect(
      deriveRooms(doc)
        .map((r) => r.id)
        .sort(),
    ).toEqual(before.map((r) => r.id).sort());
  });
  it('open chains are not rooms', () => {
    const doc = twoRooms();
    doc.walls = doc.walls.slice(0, 2);
    expect(deriveRooms(doc)).toEqual([]);
  });
});
