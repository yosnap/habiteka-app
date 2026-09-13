import { describe, expect, it } from 'vitest';
import { emptyEditorDocument, type Ramp } from '@/lib/editor-document/schema';
import { alignmentGuides } from '@/canvas/editor-v2/alignment-guides';

describe('alignment guides', () => {
  it('finds the parallel ramp edge and a wall face for a selected landing', () => {
    const doc = emptyEditorDocument();
    doc.vertices = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 5000, y: 0 }];
    doc.walls = [{ id: 'wall', startVertexId: 'a', endVertexId: 'b', thicknessMm: 150, dimensionalOrigin: 'physical' }];
    const ramp: Ramp = { id: 'ramp', catalogId: 'builtin:ramp-straight', x: 3000, y: 500, widthMm: 1200, depthMm: 3000,
      riseMm: 1000, elevationMm: 0, rotation: 0, materialId: 'concrete-grey' };
    const landing: Ramp = { id: 'landing', catalogId: 'builtin:ramp-landing', x: 3000, y: 1800, widthMm: 1200, depthMm: 1200,
      riseMm: 0, elevationMm: 1000, rotation: 0, materialId: 'concrete-grey' };
    doc.ramps = [ramp, landing];
    const guides = alignmentGuides(doc, landing);
    expect(guides.some((guide) => guide.edge.sourceId === 'ramp')).toBe(true);
    expect(guides.some((guide) => guide.edge.sourceId === 'wall')).toBe(true);
  });
});
