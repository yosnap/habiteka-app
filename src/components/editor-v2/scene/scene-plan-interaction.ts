import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import type { ThreeEvent, RootState } from '@react-three/fiber';
import { Object3D, Plane, Raycaster, Vector2, Vector3 } from 'three';
import type { EditorStore } from '@/canvas/editor-v2/store';
import type { Furniture, Point } from '@/lib/editor-document/schema';
import type { SpatialClipboardItem } from '@/canvas/editor-v2/spatial-clipboard';
import { planObjects } from '@/lib/editor-document/boundary-types';
import { objectCenter } from '@/lib/editor-document/spatial-properties';
import { updateFurniture } from '@/lib/editor-document/spatial-commands';
import { restOnHost } from '@/lib/editor-document/object-host-rest';

export interface PlanDrag {
  id: string;
  start: Point;
  item: Furniture;
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
  const item = planObjects(state.document).find((entry) => entry.id === id);
  const start = scenePlanPoint(root, event.clientX, event.clientY, elevationM);
  if (!item || !start) return null;
  event.stopPropagation();
  // La barra de medidas se superpone al lienzo; el arrastre conserva su punto inicial.
  root.current?.get().gl.domElement.setPointerCapture(event.pointerId);
  return { id: item.id, item, start, pointerId: event.pointerId };
}

export function planDragPosition(drag: PlanDrag, point: Point, store: EditorStore): Furniture {
  return settlePlanItem({ ...drag.item, x: drag.item.x + point.x - drag.start.x, y: drag.item.y + point.y - drag.start.y }, store);
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
  const next = planDragPosition(drag, point, store);
  try {
    const state = store.getState();
    state.apply(updateFurniture(state.document, drag.id, {
      x: next.x, y: next.y, rotation: next.rotation, elevationMm: next.elevationMm, hostId: next.hostId,
    }));
    store.getState().select([drag.id]);
  } catch (error) {
    store.getState().setError(error instanceof Error ? error.message : 'No se pudo mover el elemento.');
    store.getState().select([drag.id]);
  }
}
