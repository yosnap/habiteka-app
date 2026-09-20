import { describe, expect, it } from 'vitest';
import { cameraPoseSchema } from '@/lib/contracts/walkthrough-keyframe';
import { sameCameraPose } from '@/lib/contracts/storyboard-image';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { putWalkthrough, waypoint } from '@/lib/editor-document/walkthrough';
import { setStoryboardImage, setWalkthroughStoryboard } from '@/lib/editor-document/walkthrough-storyboard';
import { parseEditorDocument } from '@/lib/editor-document/validation';
import { createEditorStore } from '@/canvas/editor-v2/store';

const camera = cameraPoseSchema.parse({ position: [1, 1.6, 2], focus: [2, 1.6, 2], fovDeg: 75, levelId: null });
function fixture() {
  const point = waypoint({ x: 1000, y: 2000 });
  const doc = putWalkthrough(emptyEditorDocument(), { id: 'route', name: 'Ruta', zoneIds: [], loop: false, waypoints: [point] });
  return { doc, image: { waypointId: point.id, deliverableId: 'render-1', camera } };
}
describe('imágenes por vista', () => {
  it('guarda referencia y cámara, sobrevive serialización y admite reemplazo sin duplicados', () => {
    const { doc, image } = fixture();
    const saved = setStoryboardImage(doc, 'route', image);
    expect(parseEditorDocument(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
    expect(saved.walkthroughs![0]!.storyboardWaypointIds).toEqual([image.waypointId]);
    expect(doc.walkthroughs![0]!.storyboardImages).toBeUndefined();
    const replaced = setStoryboardImage(saved, 'route', { ...image, deliverableId: 'render-2' });
    expect(replaced.walkthroughs![0]!.storyboardImages).toEqual([{ ...image, deliverableId: 'render-2' }]);
    const store = createEditorStore(saved);
    store.getState().apply(replaced); store.getState().undo();
    expect(store.getState().document.walkthroughs![0]!.storyboardImages![0]!.deliverableId).toBe('render-1');
  });
  it('rechaza puntos eliminados, otra planta y cámaras inválidas', () => {
    const { doc, image } = fixture();
    expect(() => setStoryboardImage(doc, 'gone', image)).toThrow();
    expect(() => setStoryboardImage(doc, 'route', { ...image, waypointId: 'gone' })).toThrow();
    expect(() => setStoryboardImage(doc, 'route', { ...image, camera: { ...camera, levelId: 'other' } })).toThrow();
    expect(() => setStoryboardImage(doc, 'route', { ...image, camera: { ...camera, focus: camera.position } })).toThrow();
  });
  it('quitar vista o punto retira su asociación sin afectar al entregable', () => {
    const { doc, image } = fixture();
    const saved = setStoryboardImage(doc, 'route', image);
    expect(setWalkthroughStoryboard(saved, 'route', []).walkthroughs![0]!.storyboardImages).toEqual([]);
    expect(putWalkthrough(saved, { ...saved.walkthroughs![0]!, waypoints: [] }).walkthroughs![0]!.storyboardImages).toEqual([]);
  });
  it('validación rechaza referencias huérfanas, duplicadas y campos extra', () => {
    const { doc, image } = fixture();
    const saved = setStoryboardImage(doc, 'route', image);
    for (const images of [[image, image], [{ ...image, waypointId: 'gone' }], [{ ...image, assetUrl: 'https://example.com' }]]) {
      const raw = structuredClone(saved);
      raw.walkthroughs![0]!.storyboardImages = images;
      expect(() => parseEditorDocument(raw)).toThrow();
    }
  });
  it('compara dirección normalizada pero distingue posición, mirada, FOV y planta', () => {
    expect(sameCameraPose(camera, { ...camera, focus: [20, 1.6, 2] })).toBe(true);
    expect(sameCameraPose(camera, { ...camera, focus: [0, 1.6, 2] })).toBe(false);
    expect(sameCameraPose(camera, { ...camera, position: [1.1, 1.6, 2] })).toBe(false);
    expect(sameCameraPose(camera, { ...camera, fovDeg: 50 })).toBe(false);
    expect(sameCameraPose(camera, { ...camera, levelId: 'other' })).toBe(false);
  });
});
