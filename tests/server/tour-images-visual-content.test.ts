import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('@/server/storage/render-urls', () => ({ resolveRenderUrl: vi.fn() }));
vi.mock('@/server/editor/document-repo', () => ({ withEditorDocuments: vi.fn() }));
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { sameVisualDesignContent } from '@/server/walkthrough/tour-images';

// Dos estancias de 4 × 4 m separadas por un tabique; cada una con su rótulo.
const plan = () => {
  const doc = emptyEditorDocument();
  doc.vertices = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 4000, y: 0 }, { id: 'c', x: 8000, y: 0 },
    { id: 'd', x: 8000, y: 4000 }, { id: 'e', x: 4000, y: 4000 }, { id: 'f', x: 0, y: 4000 }];
  doc.walls = [['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'e'], ['e', 'f'], ['f', 'a'], ['b', 'e']].map(([start, end], index) => ({
    id: `w${index}`, startVertexId: start!, endVertexId: end!, thicknessMm: 100, dimensionalOrigin: 'physical' as const }));
  doc.labels = [{ id: 'l1', x: 2000, y: 2000, text: 'Salón' }, { id: 'l2', x: 6000, y: 2000, text: 'Dormitorio' }];
  return doc;
};

describe('contenido visual comparable entre revisiones', () => {
  it('admite mover un rótulo dentro de su estancia', () => {
    const moved = plan();
    moved.labels[0] = { ...moved.labels[0]!, x: 1200, y: 3100 };
    expect(sameVisualDesignContent(plan(), moved)).toBe(true);
  });
  it('distingue un rótulo que pasa a otra estancia o cambia de texto', () => {
    const swapped = plan();
    swapped.labels[0] = { ...swapped.labels[0]!, x: 6500 };
    expect(sameVisualDesignContent(plan(), swapped)).toBe(false);
    const renamed = plan();
    renamed.labels[0] = { ...renamed.labels[0]!, text: 'Cocina' };
    expect(sameVisualDesignContent(plan(), renamed)).toBe(false);
  });
  it('conserva la posición exacta de un rótulo fuera de las estancias', () => {
    const outside = plan(), moved = plan();
    outside.labels.push({ id: 'l3', x: 10000, y: 2000, text: 'Jardín' });
    moved.labels.push({ id: 'l3', x: 11000, y: 2000, text: 'Jardín' });
    expect(sameVisualDesignContent(outside, moved)).toBe(false);
  });
});
