import { describe, expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { videoScopeRegions } from '@/lib/editor-document/video-content-scope';
import { videoBuildingBounds } from '@/components/editor-v2/scene/video-building-bounds';
import { videoDimensions } from '@/components/editor-v2/scene/video-dimensions';

const vertices = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 4000, y: 0 }, { id: 'c', x: 4000, y: 5000 }, { id: 'd', x: 0, y: 5000 }];
const document = { ...emptyEditorDocument(), vertices: [...vertices, { id: 'outside', x: 100000, y: 100000 }],
  walls: ['a', 'b', 'c', 'd'].map((id, index) => ({ id: `wall-${id}`, startVertexId: id,
    endVertexId: ['b', 'c', 'd', 'a'][index]!, thicknessMm: 200, dimensionalOrigin: 'physical' as const })) };
describe('ámbito de vídeo', () => {
  it('encuadra y acota interiores sin incluir puntos del exterior ni alterar el original', () => {
    const regions = videoScopeRegions(document, 'house');
    expect(regions).toHaveLength(1);
    expect(videoBuildingBounds(document, regions)).toMatchObject({ minX: 0, maxX: 4, minZ: 0, maxZ: 5 });
    expect(videoDimensions(document, regions)).toContain('4,00 × 5,00');
    expect(document.vertices).toHaveLength(5);
    expect(videoScopeRegions(document, 'all')).toEqual([]);
    expect(videoBuildingBounds(document).maxX).toBe(100);
  });
  it('no presenta un patio como vivienda ni degrada silenciosamente una selección imposible', () => {
    expect(() => videoScopeRegions({ ...document, labels: [{ id: 'label', x: 2000, y: 2000, text: 'Patio' }] }, 'house')).toThrow(/interiores cerradas/);
    expect(() => videoScopeRegions(emptyEditorDocument(), 'house')).toThrow(/interiores cerradas/);
  });
});
