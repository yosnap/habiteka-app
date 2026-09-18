import { storyboardImageSchema } from '@/lib/contracts/storyboard-image';
import type { EditorDocument } from './schema';
import { putWalkthrough } from './walkthrough';

/** Guarda únicamente referencias; las poses se obtienen del plano actual al capturar. */
export function setWalkthroughStoryboard(doc: EditorDocument, routeId: string, waypointIds: string[]): EditorDocument {
  const route = doc.walkthroughs?.find((item) => item.id === routeId);
  if (!route) throw new Error('El recorrido ya no existe.');
  const validIds = new Set(route.waypoints.map((point) => point.id));
  if (new Set(waypointIds).size !== waypointIds.length || waypointIds.some((id) => !validIds.has(id))) {
    throw new Error('Elige puntos del recorrido sin repetirlos.');
  }
  return putWalkthrough(doc, { ...route, storyboardWaypointIds: [...waypointIds] });
}

/** Las URLs firmadas no se guardan en el plano: solo el id estable y el encuadre. */
export function setStoryboardImage(doc: EditorDocument, routeId: string, raw: import('@/lib/contracts/storyboard-image').StoryboardImage): EditorDocument {
  const image = storyboardImageSchema.parse(raw);
  const route = doc.walkthroughs?.find((item) => item.id === routeId);
  if (!route?.waypoints.some((point) => point.id === image.waypointId)) throw new Error('El punto ya no existe.');
  if (image.camera.levelId !== (doc.activeLevelId ?? null)) throw new Error('La imagen pertenece a otra planta.');
  return putWalkthrough(doc, { ...route,
    storyboardWaypointIds: [...new Set([...(route.storyboardWaypointIds ?? []), image.waypointId])],
    storyboardImages: [...(route.storyboardImages ?? []).filter((item) => item.waypointId !== image.waypointId), image],
  });
}
