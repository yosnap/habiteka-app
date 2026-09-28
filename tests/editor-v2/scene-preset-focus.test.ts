import { describe, expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { scenePresetFocus } from '@/components/editor-v2/scene/scene-preset-focus';

describe('encuadre de vistas arquitectónicas', () => {
  it('centra los muros sin reducir el edificio por elementos exteriores lejanos', () => {
    const document = emptyEditorDocument();
    document.vertices = [
      { id: 'a', x: 0, y: 0 }, { id: 'b', x: 10000, y: 0 },
      { id: 'c', x: 10000, y: 8000 }, { id: 'fuera', x: 90000, y: 90000 },
    ];
    document.walls = [
      { id: 'ab', startVertexId: 'a', endVertexId: 'b', thicknessMm: 200, dimensionalOrigin: 'physical', heightMm: 3200 },
      { id: 'bc', startVertexId: 'b', endVertexId: 'c', thicknessMm: 200, dimensionalOrigin: 'physical', heightMm: 3200 },
    ];
    const frontal = scenePresetFocus(document, 'front');
    expect(frontal?.center).toEqual([5, 1.6, 4]);
    expect(frontal?.size[0]).toBeCloseTo(15.5);
    expect(frontal?.size[1]).toBeCloseTo(4.96);
    expect(frontal?.size[2]).toBeCloseTo(12.4);
    expect(scenePresetFocus(document, 'drone')?.size[0]).toBeCloseTo(17);
    expect(scenePresetFocus(document, 'top')).toBeUndefined();
  });

  it('conserva el encuadre general si no hay muros físicos', () => {
    expect(scenePresetFocus(emptyEditorDocument(), 'right')).toBeUndefined();
  });

  it('muestra la piscina próxima completa desde el dron sin ampliar las fachadas', () => {
    const document = emptyEditorDocument();
    document.vertices = [
      { id: 'a', x: 0, y: 0 }, { id: 'b', x: 10000, y: 0 },
      { id: 'c', x: 10000, y: 8000 },
    ];
    document.walls = [
      { id: 'ab', startVertexId: 'a', endVertexId: 'b', thicknessMm: 200, dimensionalOrigin: 'physical' },
      { id: 'bc', startVertexId: 'b', endVertexId: 'c', thicknessMm: 200, dimensionalOrigin: 'physical' },
    ];
    document.furniture = [
      { id: 'pool', kind: 'piscina', x: 5000, y: 16000, widthMm: 6000, depthMm: 3000, rotation: 0, dimensionalOrigin: 'physical' },
      { id: 'remote-pool', kind: 'piscina', x: 90000, y: 90000, widthMm: 6000, depthMm: 3000, rotation: 0, dimensionalOrigin: 'physical' },
    ];
    const drone = scenePresetFocus(document, 'drone');
    expect(drone?.center).toEqual([5, 1.4, 8.75]);
    expect(drone?.size[2]).toBeCloseTo(23.625);
    expect(scenePresetFocus(document, 'front')?.center).toEqual([5, 1.4, 4]);
  });
});
