import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import type { ThreeEvent, RootState } from '@react-three/fiber';
import { Object3D, Plane, Raycaster, Vector2, Vector3 } from 'three';
import type { EditorStore } from '@/canvas/editor-v2/store';
import type { Furniture, Point, TerrainSurface } from '@/lib/editor-document/schema';
import type { SpatialClipboardItem } from '@/canvas/editor-v2/spatial-clipboard';
import { duplicatePlanElement } from '@/canvas/editor-v2/duplicate-plan-element';
import { planObjects } from '@/lib/editor-document/boundary-types';
import { objectCenter } from '@/lib/editor-document/spatial-properties';
import { updateFurniture } from '@/lib/editor-document/spatial-commands';
import { restOnHost } from '@/lib/editor-document/object-host-rest';
import { updateTerrainSurface } from '@/lib/editor-document/terrain-surfaces';
import { snapTerrainMove } from '@/canvas/editor-v2/terrain-transform';
import { constrainSeatingDrag } from '@/canvas/editor-v2/seating-drag';

export interface PlanDrag {
  last?: Furniture;
  id: string;
  start: Point;
  item: Furniture | TerrainSurface;
  terrain?: boolean;
  duplicate?: boolean;
  pointerId: number;
}
export interface PlanMovePreview { id: string; dxMm: number; dyMm: number; dzMm: number }

/** Finds the editor entity behind a GLB child mesh or a generated scene mesh. */
export function sceneEntityId(object: Object3D | null): string | null {
  for (let current = object; current; current = current.parent) {
    if (typeof current.userData.sourceEntityId === 'string') return current.userData.sourceEntityId;
  }
  return null;
}

/** The top camera looks at the same X/Z metre plane as the 2D document's X/Y millimetres. */
export function scenePlanPoint(root: RefObject<RootState | null>, clientX: number, clientY: number, elevationM: number): Point | null {
  const state = root.current?.get();
  if (!state) return null;
  const rect = state.gl.domElement.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const pointer = new Vector2((clientX - rect.left) / rect.width * 2 - 1, 1 - (clientY - rect.top) / rect.height * 2);
  const raycaster = new Raycaster();
  raycaster.setFromCamera(pointer, state.camera);
  const hit = raycaster.ray.intersectPlane(new Plane(new Vector3(0, 1, 0), -elevationM), new Vector3());
  return hit ? { x: hit.x * 1000, y: hit.z * 1000 } : null;
}

/** Píxeles por milímetro a la altura del plano, también al cambiar el zoom visual. */
export function scenePlanScale(root: RefObject<RootState | null>, elevationM: number): number {
  const rect = root.current?.get().gl.domElement.getBoundingClientRect();
  if (!rect) return .05;
  const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
  const a = scenePlanPoint(root, x, y, elevationM), b = scenePlanPoint(root, x + 1, y, elevationM);
  return a && b ? 1 / Math.max(.001, Math.hypot(b.x - a.x, b.y - a.y)) : .05;
}

/** En la vista visual, el imán del plano técnico causaba saltos de hasta varios centímetros. */
function settlePlanItem<T extends SpatialClipboardItem>(item: T, store: EditorStore): T {
  const state = store.getState();
  const positioned = state.snap ? { ...item, x: Math.round(item.x / 10) * 10, y: Math.round(item.y / 10) * 10 } : item;
  return ('kind' in positioned ? restOnHost(state.document, positioned as Furniture) : positioned) as T;
}

export function positionedPending(item: SpatialClipboardItem, point: Point, store: EditorStore): SpatialClipboardItem {
  const center = objectCenter(item);
  return settlePlanItem({ ...item, x: item.x + point.x - center.x, y: item.y + point.y - center.y }, store);
}

export function beginPlanDrag(event: ThreeEvent<PointerEvent>, store: EditorStore,
  root: RefObject<RootState | null>, elevationM: number): PlanDrag | null {
  const state = store.getState();
  if (event.button !== 0 || state.readOnly || state.tool !== 'select') return null;
  const id = sceneEntityId(event.object);
  const furniture = planObjects(state.document).find((entry) => entry.id === id);
  const terrain = state.document.terrainSurfaces?.find((entry) => entry.id === id);
  const item = furniture ?? terrain;
  const start = scenePlanPoint(root, event.clientX, event.clientY, elevationM);
  if (!item || !start) return null;
  event.stopPropagation();
  // La barra de medidas se superpone al lienzo; el arrastre conserva su punto inicial.
  root.current?.get().gl.domElement.setPointerCapture(event.pointerId);
  return { id: item.id, item, terrain: Boolean(terrain), duplicate: event.altKey, start, pointerId: event.pointerId };
}

export function planDragPosition(drag: PlanDrag, point: Point, store: EditorStore, scale = .05): Furniture | TerrainSurface {
  const moved = { ...drag.item, x: drag.item.x + point.x - drag.start.x, y: drag.item.y + point.y - drag.start.y };
  if (!drag.terrain) {
    const target = settlePlanItem(moved as Furniture, store);
    if (drag.duplicate) return target;
    const placed = constrainSeatingDrag(store.getState().document, drag.last ?? drag.item as Furniture, target);
    drag.last = placed; return placed;
  }
  const state = store.getState();
  const result = snapTerrainMove(state.document, drag.item as TerrainSurface,
    { x: moved.x - drag.item.x, y: moved.y - drag.item.y }, scale, state.snap);
  state.setMagneticGuides(result.guides);
  return { ...moved, x: drag.item.x + result.delta.x, y: drag.item.y + result.delta.y } as TerrainSurface;
}

export function finishPlanDrag(event: ReactPointerEvent<HTMLDivElement>, drag: PlanDrag,
  store: EditorStore, root: RefObject<RootState | null>, elevationM: number): void {
  if (event.pointerId !== drag.pointerId) return;
  const canvas = root.current?.get().gl.domElement;
  if (canvas?.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  const point = scenePlanPoint(root, event.clientX, event.clientY, elevationM);
  if (!point || Math.hypot(point.x - drag.start.x, point.y - drag.start.y) < 30) {
    store.getState().select([drag.id]);
    return;
  }
  const next = planDragPosition(drag, point, store, scenePlanScale(root, elevationM));
  store.getState().setMagneticGuides([]);
  try {
    const state = store.getState();
    if (drag.duplicate) {
      const copy = duplicatePlanElement(state.document, drag.id, { x: next.x - drag.item.x, y: next.y - drag.item.y });
      state.apply(copy.document); store.getState().select([copy.id]); return;
    }
    state.apply(drag.terrain ? updateTerrainSurface(state.document, drag.id, { x: next.x, y: next.y })
      : updateFurniture(state.document, drag.id, {
        x: next.x, y: next.y, rotation: (next as Furniture).rotation,
        elevationMm: (next as Furniture).elevationMm, hostId: (next as Furniture).hostId,
      }));
    store.getState().select([drag.id]);
  } catch (error) {
    store.getState().setError(error instanceof Error ? error.message : 'No se pudo mover el elemento.');
    store.getState().select([drag.id]);
  }
}
