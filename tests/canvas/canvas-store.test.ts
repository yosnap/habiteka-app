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
});
