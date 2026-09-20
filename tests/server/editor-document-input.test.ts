import { describe, expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import {
  assertRevision,
  documentFingerprint,
  readDocumentInput,
} from '@/server/editor/document-input';

describe('document transport boundary', () => {
  it('bounds entity counts before quadratic topology validation', () => {
    const doc = emptyEditorDocument();
    doc.vertices = Array.from({ length: 2001 }, (_, i) => ({ id: `v${i}`, x: i, y: 0 }));
    expect(() => readDocumentInput(doc)).toThrow('límite de elementos');
    doc.vertices = doc.vertices.slice(0, 200);
    expect(readDocumentInput(doc).vertices).toHaveLength(200);
  });
  it('limits encoded UTF-8 bytes, not JavaScript string length', () => {
    expect(() =>
      readDocumentInput({ ...emptyEditorDocument(), extra: 'é'.repeat(1_000_001) }),
    ).toThrow('grande');
  });
  it('fingerprints equivalent JSON independently of property insertion order', () => {
    expect(documentFingerprint({ b: [1, 2], a: { y: 2, x: 1 } })).toBe(
      documentFingerprint({ a: { x: 1, y: 2 }, b: [1, 2] }),
    );
  });
  it.each([NaN, Infinity, -1, 0.5, 2_147_483_647])('rejects invalid revision %s', (value) => {
    expect(() => assertRevision(value)).toThrow();
  });
  it('rejects values JSON serialization would silently alter or drop', () => {
    for (const extra of [NaN, new Date(), () => 1]) {
      expect(() => readDocumentInput({ ...emptyEditorDocument(), extra })).toThrow();
    }
  });
  it('rejects oversized payload before geometric validation', () => {
    expect(() =>
      readDocumentInput({ ...emptyEditorDocument(), extra: 'x'.repeat(2_000_000) }),
    ).toThrow('grande');
  });
});
