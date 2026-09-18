import { describe, expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { putWalkthrough, waypoint } from '@/lib/editor-document/walkthrough';
import { setWalkthroughStoryboard } from '@/lib/editor-document/walkthrough-storyboard';
import { parseEditorDocument } from '@/lib/editor-document/validation';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { addBuildingLevel, switchBuildingLevel } from '@/lib/editor-document/building-levels';

function fixture() {
  return putWalkthrough(emptyEditorDocument(), {
    id: 'route', name: 'Ruta', zoneIds: [], loop: false,
    waypoints: [waypoint({ x: 1000, y: 1000 }), waypoint({ x: 2000, y: 1000 }), waypoint({ x: 3000, y: 1000 })],
  });
}

describe('secuencia de vistas del recorrido', () => {
  it('conserva orden editorial al serializar sin alterar orden físico ni documento original', () => {
    const doc = fixture(), path = doc.walkthroughs![0]!;
    const order = [path.waypoints[2]!.id, path.waypoints[0]!.id];
    const saved = setWalkthroughStoryboard(doc, path.id, order);
    expect(parseEditorDocument(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
    expect(saved.walkthroughs![0]!.storyboardWaypointIds).toEqual(order);
    expect(saved.walkthroughs![0]!.waypoints).toEqual(path.waypoints);
    expect(path.storyboardWaypointIds).toBeUndefined();
    order.reverse();
    expect(saved.walkthroughs![0]!.storyboardWaypointIds).not.toEqual(order);
  });
  it('rechaza referencias ajenas, duplicadas y rutas que ya no existen', () => {
    const doc = fixture(), point = doc.walkthroughs![0]!.waypoints[0]!.id;
    expect(() => setWalkthroughStoryboard(doc, 'route', ['other'])).toThrow();
    expect(() => setWalkthroughStoryboard(doc, 'route', [point, point])).toThrow();
    expect(() => setWalkthroughStoryboard(doc, 'missing', [])).toThrow();
    for (const invalid of [[point, point], ['other'], 'invalid', [42]]) {
      const raw = JSON.parse(JSON.stringify(doc));
      raw.walkthroughs[0].storyboardWaypointIds = invalid;
      expect(() => parseEditorDocument(raw)).toThrow();
    }
  });
  it('retira la vista al borrar su punto y permite vaciar la selección', () => {
    const doc = fixture(), path = doc.walkthroughs![0]!;
    const selected = setWalkthroughStoryboard(doc, path.id, path.waypoints.map((point) => point.id));
    const next = putWalkthrough(selected, { ...selected.walkthroughs![0]!, waypoints: path.waypoints.slice(1) });
    expect(next.walkthroughs![0]!.storyboardWaypointIds).toEqual(path.waypoints.slice(1).map((point) => point.id));
    expect(setWalkthroughStoryboard(next, path.id, []).walkthroughs![0]!.storyboardWaypointIds).toEqual([]);
  });
  it('participa en deshacer/rehacer y permanece en su planta', () => {
    const doc = fixture(), path = doc.walkthroughs![0]!, order = [path.waypoints[1]!.id];
    const store = createEditorStore(doc);
    store.getState().apply(setWalkthroughStoryboard(doc, path.id, order));
    store.getState().undo();
    expect(store.getState().document.walkthroughs![0]!.storyboardWaypointIds).toBeUndefined();
    store.getState().redo();
    expect(store.getState().document.walkthroughs![0]!.storyboardWaypointIds).toEqual(order);
    const upstairs = addBuildingLevel(store.getState().document);
    expect(upstairs.walkthroughs).toEqual([]);
    const downstairs = switchBuildingLevel(upstairs, upstairs.levels![0]!.id);
    expect(downstairs.walkthroughs![0]!.storyboardWaypointIds).toEqual(order);
  });
});

it('oculta recorrido y detiene cámara sin borrar rutas, vistas ni historial', () => {
  const doc = fixture(), route = doc.walkthroughs![0]!;
  const saved = setWalkthroughStoryboard(doc, route.id, [route.waypoints[0]!.id]);
  const store = createEditorStore(saved);
  store.getState().setWalkthrough(route.id);
  store.getState().setTool('walkthrough');
  store.getState().setWalkthroughPlaying(true);
  const before = store.getState();
  store.getState().hideWalkthrough();
  expect(store.getState().walkthroughId).toBeNull();
  expect(store.getState().walkthroughPlaying).toBe(false);
  expect(store.getState().tool).toBe('select');
  expect(store.getState().document).toBe(before.document);
  expect(store.getState().past).toBe(before.past);
  expect(store.getState().sequence).toBe(before.sequence);
  store.getState().setWalkthrough(route.id);
  expect(store.getState().document.walkthroughs![0]!.storyboardWaypointIds).toEqual([route.waypoints[0]!.id]);
});
