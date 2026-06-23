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
  type BaseImage,
  type StructObj,
  type Stroke,
  type ProductRef,
  type CanvasSelection,
  type CanvasScale,
  type FloorVertex,
  emptyCanvasDoc,
} from './types';
import { outlineToWalls } from './wizard/room-shapes';
import { DEFAULT_WALL_THICKNESS_M } from './draw-wall';
import { metersToPx } from './scale';

interface CanvasState {
  doc: CanvasDoc;
  past: CanvasDoc[];
  future: CanvasDoc[];

  load(doc: CanvasDoc): void;
  /** Fija (o quita, con null) la imagen de fondo del lienzo. Entra en historial. */
  setBaseImage(image: BaseImage | null): void;
  /** Ajusta la opacidad del fondo actual (0–1); no hace nada si no hay fondo. */
  setBaseImageOpacity(opacity: number): void;
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
  /** Agrupa los objetos indicados bajo un mismo `groupId`. */
  groupObjects(ids: string[]): void;
  /** Desagrupa: quita el `groupId` de los objetos indicados. */
  ungroupObjects(ids: string[]): void;
  /** Rota 90° en horario: uno sobre su centro; varios como bloque (centro común). */
  rotate90(ids: string[]): void;
  /** Voltea en horizontal: uno sobre su centro; varios espejando el bloque. */
  flipSelection(ids: string[]): void;
  addProduct(product: ProductRef): void;
  /** Fija (o quita, con null) la escala arquitectónica del plano. Entra en historial. */
  setScale(scale: CanvasScale | null): void;
  /** Fija (o quita, con null) la altura de techo del plano en metros. Entra en historial. */
  setCeilingHeight(meters: number | null): void;
  /**
   * Fija el contorno del suelo (vértices) y REGENERA los muros del contorno a partir de él.
   * Es la operación del editor de contorno: al mover/añadir/quitar un vértice, los muros se
   * reconstruyen para seguir el polígono (esquinas siempre cuadradas). Conserva muebles,
   * ventanas/puertas y luces. Entra en historial.
   */
  setFloorOutline(vertices: FloorVertex[]): void;
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

    setBaseImage: (image) => mutate((d) => ({ ...d, baseImage: image })),

    setBaseImageOpacity: (opacity) =>
      mutate((d) =>
        d.baseImage
          ? { ...d, baseImage: { ...d.baseImage, opacity: Math.min(1, Math.max(0, opacity)) } }
          : d,
      ),

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
            const id = `obj-clone-${globalThis.crypto.randomUUID()}`;
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

    groupObjects: (ids) => {
      if (ids.length < 2) return;
      const groupId = `grp-${globalThis.crypto.randomUUID()}`;
      mutate((d) => ({
        ...d,
        objects: d.objects.map((o) => (ids.includes(o.id) ? { ...o, groupId } : o)),
      }));
    },

    ungroupObjects: (ids) =>
      mutate((d) => ({
        ...d,
        objects: d.objects.map((o) => {
          if (!ids.includes(o.id) || o.groupId === undefined) return o;
          const rest = { ...o };
          delete rest.groupId;
          return rest;
        }),
      })),

    rotate90: (ids) =>
      mutate((d) => {
        const sel = d.objects.filter((o) => ids.includes(o.id));
        if (sel.length <= 1) {
          return {
            ...d,
            objects: d.objects.map((o) =>
              ids.includes(o.id) ? { ...o, rotation: (o.rotation + 90) % 360 } : o,
            ),
          };
        }
        const c = bboxCenter(sel);
        return {
          ...d,
          objects: d.objects.map((o) => {
            if (!ids.includes(o.id)) return o;
            const ocx = o.x + o.width / 2;
            const ocy = o.y + o.height / 2;
            // 90° horaria del centro del objeto alrededor del centro común.
            const rx = c.x - (ocy - c.y);
            const ry = c.y + (ocx - c.x);
            const nw = o.height;
            const nh = o.width;
            return {
              ...o,
              x: rx - nw / 2,
              y: ry - nh / 2,
              width: nw,
              height: nh,
              rotation: (o.rotation + 90) % 360,
            };
          }),
        };
      }),

    flipSelection: (ids) =>
      mutate((d) => {
        const sel = d.objects.filter((o) => ids.includes(o.id));
        if (sel.length <= 1) {
          return {
            ...d,
            objects: d.objects.map((o) => (ids.includes(o.id) ? { ...o, flipX: !o.flipX } : o)),
          };
        }
        const c = bboxCenter(sel);
        return {
          ...d,
          objects: d.objects.map((o) => {
            if (!ids.includes(o.id)) return o;
            const ocx = o.x + o.width / 2;
            const mirroredCx = 2 * c.x - ocx;
            return { ...o, x: mirroredCx - o.width / 2, flipX: !o.flipX };
          }),
        };
      }),

    addProduct: (product) => mutate((d) => ({ ...d, products: [...d.products, product] })),

    setScale: (scale) =>
      mutate((d) => {
        if (scale) return { ...d, scale };
        // Quitar la escala: el campo es opcional, así que se elimina del doc.
        const rest = { ...d };
        delete rest.scale;
        return rest;
      }),

    setCeilingHeight: (meters) =>
      mutate((d) => {
        if (meters && Number.isFinite(meters) && meters > 0) {
          return { ...d, ceilingHeightM: meters };
        }
        const rest = { ...d };
        delete rest.ceilingHeightM;
        return rest;
      }),

    setFloorOutline: (vertices) =>
      mutate((d) => {
        if (vertices.length < 3) return d;
        // Grosor de muro en px: se conserva el del contorno actual (el lado corto del primer
        // muro existente) para no cambiarlo al editar; si no hay muros, el grosor por defecto.
        const existingWalls = d.objects.filter((o) => o.kind === 'wall');
        const pxPerMeter = d.scale?.pxPerMeter;
        const defaultT =
          typeof pxPerMeter === 'number' && pxPerMeter > 0
            ? metersToPx(DEFAULT_WALL_THICKNESS_M, { pxPerMeter })
            : 15;
        const t = existingWalls.length
          ? Math.min(...existingWalls.map((w) => Math.min(w.width, w.height)))
          : defaultT;
        const newWalls = outlineToWalls(vertices, t);
        // Reemplaza SOLO los muros (conserva muebles, ventanas/puertas, luces y su z-order
        // relativo: los no-muros se mantienen, los muros nuevos van al fondo del array).
        const nonWalls = d.objects.filter((o) => o.kind !== 'wall');
        return { ...d, objects: [...newWalls, ...nonWalls], floorOutline: vertices };
      }),

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

/** Centro del bounding box conjunto de un conjunto de objetos. */
function bboxCenter(objs: StructObj[]) {
  const minX = Math.min(...objs.map((o) => o.x));
  const minY = Math.min(...objs.map((o) => o.y));
  const maxX = Math.max(...objs.map((o) => o.x + o.width));
  const maxY = Math.max(...objs.map((o) => o.y + o.height));
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
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
