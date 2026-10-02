import { afterEach, describe, expect, it, vi } from 'vitest';
import { Group, Mesh, PerspectiveCamera, Sprite } from 'three';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { createVideoDimensionOverlay } from '@/components/editor-v2/scene/video-dimension-overlay';
import { videoDimensionAnchors } from '@/components/editor-v2/scene/video-dimensions';
import { DEFAULT_VIDEO_PRESENTATION, dimensionReveal, videoDimensionMode, videoPresentationSchema } from '@/lib/editor-document/video-presentation';

afterEach(() => vi.unstubAllGlobals());
const house = () => addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 5000 }, { x: 0, y: 5000 }], true);
describe('cotas del vídeo', () => {
  it('dibuja una cota cada vez; solo al inicio desaparece por completo a los cuatro segundos', () => {
    expect(dimensionReveal('animated', 325, 0).progress).toBe(.5);
    expect(dimensionReveal('animated', 325, 1).progress).toBe(0);
    expect(dimensionReveal('animated', 975, 0).progress).toBe(1);
    expect(dimensionReveal('animated', 975, 1).progress).toBe(.5);
    expect(dimensionReveal('start', 1000, 0)).toEqual({ progress: 1, opacity: 1 });
    expect(dimensionReveal('start', 4000, 0).opacity).toBe(0);
    expect(dimensionReveal('fixed', 29000, 0).progress).toBe(1);
    expect(dimensionReveal('none', 1000, 0).opacity).toBe(0);
  });
  it('conserva la compatibilidad y rechaza modos, volúmenes o guiones inválidos', () => {
    expect(videoDimensionMode({ soundEffects: false, soundVolume: .4, showDimensions: true })).toBe('fixed');
    expect(videoDimensionMode({ ...DEFAULT_VIDEO_PRESENTATION, showDimensions: false })).toBe('none');
    for (const bad of [{ dimensionMode: 'unknown' }, { soundVolume: 2 }, { prompt: 'x'.repeat(2001) }, { constructionDurationSeconds: 30 }]) {
      expect(videoPresentationSchema.safeParse({ ...DEFAULT_VIDEO_PRESENTATION, ...bad }).success).toBe(false);
    }
  });
  it('usa las medidas del ámbito seleccionado y la altura de los muros, no los vértices exteriores', () => {
    const doc = house(); doc.vertices.push({ id: 'far', x: 80000, y: 90000 });
    const anchors = videoDimensionAnchors(doc, [[{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 5000 }, { x: 0, y: 5000 }]]);
    expect(anchors.map(line => line.value)).toEqual([4, 5, 2.7]);
    expect(anchors[0]!.start.y).toBeGreaterThan(0);
  });
  it('usa profundidad real para líneas y etiquetas y retira todos sus recursos al terminar', () => {
    vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({ measureText: () => ({ width: 100 }), fillRect: () => {}, fillText: () => {} }) }) });
    const scene = new Group(), camera = new PerspectiveCamera(); camera.position.set(5, 8, -10);
    const overlay = createVideoDimensionOverlay(scene, house(), camera);
    overlay.update(3000, DEFAULT_VIDEO_PRESENTATION);
    const first = overlay.root.children[0] as Group, line = first.children[0] as Mesh, label = first.children[3] as Sprite;
    expect(first.visible).toBe(true); expect(label.visible).toBe(true);
    expect((line.material as import('three').Material).depthTest).toBe(true); expect(label.material.depthTest).toBe(true);
    const disposed = vi.fn(); label.material.map!.addEventListener('dispose', disposed);
    overlay.update(5000, { ...DEFAULT_VIDEO_PRESENTATION, dimensionMode: 'start' });
    expect(overlay.root.children.every(item => !item.visible)).toBe(true);
    overlay.update(1000, { ...DEFAULT_VIDEO_PRESENTATION, dimensionMode: 'fixed', dimensionOcclusion: false });
    expect(label.material.depthTest).toBe(false);
    overlay.dispose(); expect(scene.children).toHaveLength(0); expect(disposed).toHaveBeenCalledOnce();
  });
});
