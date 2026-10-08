import { describe, expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { prepareViewChange, viewForTool, viewModeBlockedReason } from '@/canvas/editor-v2/view-mode';
import { fittedView, resizedView, zoomedView } from '@/canvas/editor-v2/view-math';

const house = () => addWallPath(emptyEditorDocument(), [
  { x: -1000, y: 500 }, { x: 6000, y: 500 }, { x: 6000, y: 5500 }, { x: -1000, y: 5500 },
], true);
const item = { id: 'pending', kind: 'box' as const, x: 1000, y: 1000,
  widthMm: 500, depthMm: 500, heightMm: 500, elevationMm: 0, color: '#8ea69b', rotation: 0, dimensionalOrigin: 'physical' as const };

describe('navegación con una tarea activa', () => {
  it('elegir herramientas desde una escena abre el lienzo que permite usarlas', () => {
    for (const mode of ['2d', 'visual', '3d'] as const) {
      expect(viewForTool(mode, 'select')).toBe(mode);
      for (const tool of ['wall', 'split-wall', 'measure', 'walkthrough'] as const) expect(viewForTool(mode, tool)).toBe('2d');
    }
    expect(viewForTool('3d', 'place-object')).toBe('visual');
    expect(viewForTool('2d', 'place-object')).toBe('2d');
    expect(viewForTool('visual', 'place-object')).toBe('visual');
  });
  it('conserva selección, panel y acabados al pasar por las tres vistas', () => {
    const store = createEditorStore(house());
    store.getState().select([store.getState().document.walls[0]!.id]);
    store.getState().setDetailPanel('paint');
    const { document, selection, sidePanel, detailPanel } = store.getState();
    expect(prepareViewChange(store, '2d', 'visual')).toBe(true);
    expect(prepareViewChange(store, 'visual', '3d')).toBe(true);
    expect(prepareViewChange(store, '3d', '2d')).toBe(true);
    expect(store.getState()).toMatchObject({ document, selection, sidePanel, detailPanel, past: [] });
  });

  it('un segundo clic en Modelo 3D conserva la visibilidad elegida', () => {
    const store = createEditorStore(house());
    store.getState().setCeilingView('solid');
    prepareViewChange(store, '3d', '3d');
    expect(store.getState().ceilingView).toBe('solid');
  });

  it('permite llevar el objeto pendiente entre los dos planos y protege la entrada a 3D', () => {
    const store = createEditorStore(house());
    store.getState().openSidePanel('catalog');
    store.getState().setPan(true);
    store.getState().beginPlaceSpatial(item);
    expect(store.getState().pan).toBe(false);
    expect(prepareViewChange(store, '2d', 'visual')).toBe(true);
    expect(prepareViewChange(store, 'visual', '3d')).toBe(false);
    store.getState().setPan(true);
    store.getState().requestView('fit');
    expect(store.getState()).toMatchObject({ pendingSpatial: item, sidePanel: 'catalog', past: [] });
    store.getState().setPan(false);
    expect(prepareViewChange(store, 'visual', '2d')).toBe(true);
    store.getState().placePendingSpatial(item);
    expect(store.getState().error).toBeNull();
    expect(store.getState()).toMatchObject({ pendingSpatial: null, selection: [item.id], tool: 'select', sidePanel: 'catalog' });
    expect(store.getState().document.furniture).toHaveLength(1);
    store.getState().undo();
    expect(store.getState().document.furniture).toHaveLength(0);
  });

  it('cancelar el objeto conserva el catálogo y no crea una edición', () => {
    const store = createEditorStore(house());
    store.getState().openSidePanel('catalog');
    store.getState().beginPlaceSpatial(item);
    store.getState().cancelPendingSpatial();
    expect(store.getState()).toMatchObject({ pendingSpatial: null, tool: 'select', sidePanel: 'catalog', past: [] });
    expect(store.getState().document.furniture).toHaveLength(0);
  });

  for (const tool of ['wall', 'rectangle', 'split-wall', 'light-zone', 'door', 'walkthrough'] as const) {
    it(`mantiene ${tool} en el plano técnico sin perder su estado`, () => {
      const store = createEditorStore(house());
      store.getState().setTool(tool);
      const before = store.getState();
      expect(prepareViewChange(store, '2d', 'visual')).toBe(false);
      expect(prepareViewChange(store, '2d', '3d')).toBe(false);
      expect(viewModeBlockedReason(tool, '2d')).toBeNull();
      expect(store.getState()).toBe(before);
    });
  }
});

describe('encuadre en el espacio disponible', () => {
  for (const next of [{ width: 620, height: 700 }, { width: 390, height: 220 }]) {
    it(`conserva punto central y zoom al reservar ${next.width}×${next.height}`, () => {
      const size = { width: 1100, height: 700 }, original = { x: -137, y: 39, scale: .14 };
      const resized = resizedView(original, size, next);
      expect(resized.scale).toBe(original.scale);
      expect((next.width / 2 - resized.x) / resized.scale).toBeCloseTo((size.width / 2 - original.x) / original.scale);
      expect((next.height / 2 - resized.y) / resized.scale).toBeCloseTo((size.height / 2 - original.y) / original.scale);
      expect(resizedView(resized, next, size)).toEqual(original);
      const fit = fittedView(house(), next);
      for (const vertex of house().vertices) {
        expect(vertex.x * fit.scale + fit.x).toBeGreaterThan(0);
        expect(vertex.x * fit.scale + fit.x).toBeLessThan(next.width);
        expect(vertex.y * fit.scale + fit.y).toBeGreaterThan(0);
        expect(vertex.y * fit.scale + fit.y).toBeLessThan(next.height);
      }
    });
  }

  it('zoom tras abrir el panel mantiene el punto bajo el cursor', () => {
    const size = { width: 600, height: 500 }, view = { x: -80, y: 100, scale: .07 }, pointer = { x: 380, y: 210 };
    const zoom = zoomedView(view, 1.25, size, pointer);
    expect((pointer.x - zoom.x) / zoom.scale).toBeCloseTo((pointer.x - view.x) / view.scale);
    expect((pointer.y - zoom.y) / zoom.scale).toBeCloseTo((pointer.y - view.y) / view.scale);
  });
});
