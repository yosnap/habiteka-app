import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore } from '@/canvas/canvas-store';
import { emptyCanvasDoc, type StructObj } from '@/canvas/types';

const wall = (id: string): StructObj => ({
  id,
  kind: 'wall',
  x: 0,
  y: 0,
  width: 100,
  height: 10,
  rotation: 0,
});

describe('canvas-store (undo/redo y mutaciones)', () => {
  beforeEach(() => {
    useCanvasStore.getState().load(emptyCanvasDoc());
  });

  it('añadir un objeto lo refleja en el documento', () => {
    useCanvasStore.getState().addObject(wall('o1'));
    expect(useCanvasStore.getState().doc.objects).toHaveLength(1);
  });

  it('undo revierte la última mutación de contenido; redo la reaplica', () => {
    const s = useCanvasStore.getState();
    s.addObject(wall('o1'));
    s.addObject(wall('o2'));
    expect(useCanvasStore.getState().doc.objects).toHaveLength(2);

    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().doc.objects).toHaveLength(1);

    useCanvasStore.getState().redo();
    expect(useCanvasStore.getState().doc.objects).toHaveLength(2);
  });

  it('una nueva mutación tras undo descarta el futuro (rehacer ya no aplica)', () => {
    const s = useCanvasStore.getState();
    s.addObject(wall('o1'));
    s.addObject(wall('o2'));
    useCanvasStore.getState().undo();
    useCanvasStore.getState().addObject(wall('o3'));

    useCanvasStore.getState().redo(); // no debe traer o2 de vuelta
    const ids = useCanvasStore.getState().doc.objects.map((o) => o.id);
    expect(ids).toEqual(['o1', 'o3']);
  });

  it('cambiar la selección NO entra en el historial', () => {
    const s = useCanvasStore.getState();
    s.addObject(wall('o1'));
    s.setSelection({ type: 'object', objectIds: ['o1'] });

    useCanvasStore.getState().undo(); // revierte el addObject, no la selección
    expect(useCanvasStore.getState().doc.objects).toHaveLength(0);
  });

  it('eliminar el objeto seleccionado limpia la selección', () => {
    const s = useCanvasStore.getState();
    s.addObject(wall('o1'));
    s.setSelection({ type: 'object', objectIds: ['o1'] });
    s.removeObject('o1');
    expect(useCanvasStore.getState().doc.selection).toBeNull();
  });

  it('setBaseImage fija el fondo y entra en el historial (undo lo quita)', () => {
    const img = { url: 'https://cdn.test/r.png', width: 1024, height: 768 };
    useCanvasStore.getState().setBaseImage(img);
    expect(useCanvasStore.getState().doc.baseImage).toEqual(img);

    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().doc.baseImage).toBeNull();
  });

  it('setBaseImage(null) quita el fondo existente', () => {
    const s = useCanvasStore.getState();
    s.setBaseImage({ url: 'https://cdn.test/r.png', width: 100, height: 100 });
    s.setBaseImage(null);
    expect(useCanvasStore.getState().doc.baseImage).toBeNull();
  });

  it('setBaseImageOpacity acota a [0,1] y no hace nada sin fondo', () => {
    const s = useCanvasStore.getState();
    s.setBaseImageOpacity(0.5); // sin fondo: no rompe ni crea baseImage
    expect(useCanvasStore.getState().doc.baseImage).toBeNull();

    s.setBaseImage({ url: 'https://cdn.test/r.png', width: 100, height: 100 });
    s.setBaseImageOpacity(2); // fuera de rango por arriba
    expect(useCanvasStore.getState().doc.baseImage?.opacity).toBe(1);
    s.setBaseImageOpacity(-1); // fuera de rango por abajo
    expect(useCanvasStore.getState().doc.baseImage?.opacity).toBe(0);
  });

  it('setFloorOutline regenera los muros del contorno y guarda el polígono', () => {
    const s = useCanvasStore.getState();
    // Parte de una sala con muros viejos + un mueble que NO debe tocarse.
    s.load({
      ...emptyCanvasDoc(),
      scale: { pxPerMeter: 100 },
      objects: [
        wall('viejo-1'),
        wall('viejo-2'),
        { id: 'cama', kind: 'cama', x: 200, y: 200, width: 80, height: 120, rotation: 0 },
      ],
    });
    // Nuevo contorno: un cuadrado (4 vértices → 4 muros).
    const outline = [
      { x: 100, y: 100 },
      { x: 400, y: 100 },
      { x: 400, y: 400 },
      { x: 100, y: 400 },
    ];
    useCanvasStore.getState().setFloorOutline(outline);
    const doc = useCanvasStore.getState().doc;
    // Los muros viejos se reemplazan por los regenerados del contorno (4).
    const walls = doc.objects.filter((o) => o.kind === 'wall');
    expect(walls).toHaveLength(4);
    expect(walls.some((w) => w.id === 'viejo-1')).toBe(false);
    // El mueble se conserva.
    expect(doc.objects.some((o) => o.id === 'cama')).toBe(true);
    // El contorno se guarda.
    expect(doc.floorOutline).toEqual(outline);
  });

  it('setFloorOutline es deshacible (undo restaura los muros previos)', () => {
    const s = useCanvasStore.getState();
    s.load({
      ...emptyCanvasDoc(),
      scale: { pxPerMeter: 100 },
      objects: [wall('viejo-1'), wall('viejo-2')],
    });
    useCanvasStore.getState().setFloorOutline([
      { x: 0, y: 0 },
      { x: 300, y: 0 },
      { x: 300, y: 300 },
      { x: 0, y: 300 },
    ]);
    useCanvasStore.getState().undo();
    const objs = useCanvasStore.getState().doc.objects;
    expect(objs.some((o) => o.id === 'viejo-1')).toBe(true);
    expect(useCanvasStore.getState().doc.floorOutline).toBeUndefined();
  });
});
