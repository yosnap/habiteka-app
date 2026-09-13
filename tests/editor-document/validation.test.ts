import { describe, expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { assertEditorDocument, parseEditorDocument } from '@/lib/editor-document/validation';

describe('document boundary validation', () => {
  it.each([
    null,
    {},
    { ...emptyEditorDocument(), schemaVersion: 3 },
    { ...emptyEditorDocument(), vertices: [{ id: 'a', x: NaN, y: 0 }] },
    { ...emptyEditorDocument(), revision: Infinity },
    {
      ...emptyEditorDocument(),
      vertices: [
        { id: 'a', x: 0, y: 0 },
        { id: 'a', x: 1, y: 0 },
      ],
    },
    {
      ...emptyEditorDocument(),
      openings: [
        {
          id: 'o',
          wallId: 'missing',
          kind: 'hueco',
          position: 0.5,
          widthMm: 100,
          dimensionalOrigin: 'physical',
        },
      ],
    },
  ])('rejects malformed documents', (value) => {
    expect(() => assertEditorDocument(value)).toThrow();
  });
  it('clones instead of returning mutable caller data', () => {
    const doc = emptyEditorDocument();
    const parsed = parseEditorDocument(doc);
    parsed.vertices.push({ id: 'a', x: 0, y: 0 });
    expect(doc.vertices).toEqual([]);
  });
  it('rejects geometric crossings without an explicit shared vertex', () => {
    const doc = emptyEditorDocument();
    doc.vertices = [
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 10, y: 10 },
      { id: 'c', x: 0, y: 10 },
      { id: 'd', x: 10, y: 0 },
    ];
    doc.walls = [
      ['a', 'b'],
      ['c', 'd'],
    ].map(([a, b], i) => ({
      id: `w${i}`,
      startVertexId: a!,
      endVertexId: b!,
      thicknessMm: 1,
      dimensionalOrigin: 'physical',
    }));
    expect(() => assertEditorDocument(doc)).toThrow('Intersección');
  });
});
