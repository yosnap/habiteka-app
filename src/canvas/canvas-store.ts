/**
 * Estado del canvas en cliente con historial de deshacer/rehacer.
 *
 * El documento es la fuente de verdad; cada mutación que altera el contenido
 * empuja el estado anterior a una pila de deshacer. La selección NO entra en el
 * historial (es estado de UI efímero). El store es agnóstico de Konva: las capas
 * leen de aquí y reflejan el documento.
 */
import { create } from 'zustand';
import {
  type CanvasDoc,
  type StructObj,
  type Stroke,
  type ProductRef,
  type CanvasSelection,
  emptyCanvasDoc,
} from './types';

interface CanvasState {
  doc: CanvasDoc;
  past: CanvasDoc[];
  future: CanvasDoc[];

  load(doc: CanvasDoc): void;
  addStroke(stroke: Stroke): void;
  addObject(obj: StructObj): void;
  updateObject(id: string, patch: Partial<Omit<StructObj, 'id' | 'kind'>>): void;
  /** Aplica el mismo parche a varios objetos a la vez (multiselección). */
  updateObjects(ids: string[], patch: Partial<Omit<StructObj, 'id' | 'kind'>>): void;
  removeObject(id: string): void;
  removeObjects(ids: string[]): void;
  /** Duplica los objetos indicados (con un pequeño offset) y devuelve sus ids. */
  duplicateObjects(ids: string[]): string[];
  /** Inserta objetos ya construidos (p. ej. al pegar). */
  insertObjects(objs: StructObj[]): void;
  // Z-order: el orden del array `objects` ES el orden de apilado.
  bringToFront(ids: string[]): void;
  sendToBack(ids: string[]): void;
  bringForward(ids: string[]): void;
  sendBackward(ids: string[]): void;
  addProduct(product: ProductRef): void;
  setSelection(selection: CanvasSelection | null): void;
  undo(): void;
  redo(): void;
}

let cloneSeq = 0;

const HISTORY_LIMIT = 50;

export const useCanvasStore = create<CanvasState>((set) => {
  // Aplica una mutación de CONTENIDO registrando el estado previo para deshacer.
  const mutate = (recipe: (doc: CanvasDoc) => CanvasDoc) =>
    set((state) => {
      const next = recipe(state.doc);
      return {
        doc: next,
        past: [...state.past, state.doc].slice(-HISTORY_LIMIT),
        future: [],
      };
    });

  return {
    doc: emptyCanvasDoc(),
    past: [],
    future: [],

    load: (doc) => set({ doc, past: [], future: [] }),

    addStroke: (stroke) => mutate((d) => ({ ...d, strokes: [...d.strokes, stroke] })),

    addObject: (obj) => mutate((d) => ({ ...d, objects: [...d.objects, obj] })),

    updateObject: (id, patch) =>
      mutate((d) => ({
        ...d,
        objects: d.objects.map((o) => (o.id === id ? { ...o, ...patch } : o)),
      })),

    updateObjects: (ids, patch) =>
      mutate((d) => ({
        ...d,
        objects: d.objects.map((o) => (ids.includes(o.id) ? { ...o, ...patch } : o)),
      })),

    removeObject: (id) =>
      mutate((d) => ({
        ...d,
        objects: d.objects.filter((o) => o.id !== id),
        selection: clearSelectionOf(d.selection, [id]),
      })),

    removeObjects: (ids) =>
      mutate((d) => ({
        ...d,
        objects: d.objects.filter((o) => !ids.includes(o.id)),
        selection: clearSelectionOf(d.selection, ids),
      })),

    duplicateObjects: (ids) => {
      const newIds: string[] = [];
      mutate((d) => {
        const clones = d.objects
          .filter((o) => ids.includes(o.id))
          .map((o) => {
            cloneSeq += 1;
            const id = `obj-clone-${cloneSeq}`;
            newIds.push(id);
            return { ...o, id, x: o.x + 20, y: o.y + 20 };
          });
        return {
          ...d,
          objects: [...d.objects, ...clones],
          selection: clones.length ? { type: 'object', objectIds: newIds } : d.selection,
        };
      });
      return newIds;
    },

    insertObjects: (objs) =>
      mutate((d) => ({
        ...d,
        objects: [...d.objects, ...objs],
        selection: objs.length ? { type: 'object', objectIds: objs.map((o) => o.id) } : d.selection,
      })),

    bringToFront: (ids) =>
      mutate((d) => ({
        ...d,
        objects: [
          ...d.objects.filter((o) => !ids.includes(o.id)),
          ...d.objects.filter((o) => ids.includes(o.id)),
        ],
      })),

    sendToBack: (ids) =>
      mutate((d) => ({
        ...d,
        objects: [
          ...d.objects.filter((o) => ids.includes(o.id)),
          ...d.objects.filter((o) => !ids.includes(o.id)),
        ],
      })),

    bringForward: (ids) => mutate((d) => ({ ...d, objects: shiftZ(d.objects, ids, +1) })),
    sendBackward: (ids) => mutate((d) => ({ ...d, objects: shiftZ(d.objects, ids, -1) })),

    addProduct: (product) => mutate((d) => ({ ...d, products: [...d.products, product] })),

    // La selección no participa del historial: cambia sin tocar past/future.
    setSelection: (selection) => set((state) => ({ doc: { ...state.doc, selection } })),

    undo: () =>
      set((state) => {
        const prev = state.past.at(-1);
        if (!prev) return state;
        return {
          doc: prev,
          past: state.past.slice(0, -1),
          future: [state.doc, ...state.future],
        };
      }),

    redo: () =>
      set((state) => {
        const next = state.future[0];
        if (!next) return state;
        return {
          doc: next,
          past: [...state.past, state.doc],
          future: state.future.slice(1),
        };
      }),
  };
});

/** Quita de la selección los ids borrados; null si no queda ninguno. */
function clearSelectionOf(
  selection: CanvasSelection | null,
  removedIds: string[],
): CanvasSelection | null {
  if (selection?.type !== 'object') return selection;
  const remaining = selection.objectIds.filter((id) => !removedIds.includes(id));
  return remaining.length ? { type: 'object', objectIds: remaining } : null;
}

/** Desplaza los objetos indicados una posición en el z-order (±1). */
function shiftZ(objects: StructObj[], ids: string[], dir: 1 | -1): StructObj[] {
  const arr = [...objects];
  const indices = arr.map((o, i) => ({ o, i })).filter(({ o }) => ids.includes(o.id));
  // Para subir, procesar de mayor a menor índice; para bajar, al revés (evita choques).
  const ordered = dir === 1 ? indices.reverse() : indices;
  for (const { i } of ordered) {
    const j = i + dir;
    if (j < 0 || j >= arr.length) continue;
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}
