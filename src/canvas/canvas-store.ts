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
  removeObject(id: string): void;
  addProduct(product: ProductRef): void;
  setSelection(selection: CanvasSelection | null): void;
  undo(): void;
  redo(): void;
}

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

    removeObject: (id) =>
      mutate((d) => ({
        ...d,
        objects: d.objects.filter((o) => o.id !== id),
        selection:
          d.selection?.type === 'object' && d.selection.objectId === id ? null : d.selection,
      })),

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
