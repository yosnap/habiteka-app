import type { StoryboardImage } from '@/lib/contracts/storyboard-image';
import type { EditorDocument, Point } from './schema';
import { upgradeCeilingDocument } from './ceiling-commands';
import { parseEditorDocument } from './validation';

export interface WalkthroughWaypoint extends Point {
  id: string;
  eyeHeightMm: number;
  yawDeg?: number;
  pitchDeg?: number;
  lookAt?: Point;
  dwellMs: number;
  speedMmPerS: number;
}
/** Las rutas pertenecen al documento de su planta, igual que muros y muebles. */
export interface WalkthroughPath {
  id: string;
  name: string;
  zoneIds: string[];
  waypoints: WalkthroughWaypoint[];
  loop: boolean;
  /** Orden editorial de vistas, independiente del trayecto físico. */
  storyboardWaypointIds?: string[];
  storyboardImages?: StoryboardImage[];
}
export function upgradeWalkthroughDocument(input: EditorDocument): EditorDocument {
  const doc = upgradeCeilingDocument(input);
  if (doc.schemaVersion < 9) { doc.schemaVersion = 9; doc.walkthroughs = []; }
  return parseEditorDocument(doc);
}
export function putWalkthrough(input: EditorDocument, path: WalkthroughPath): EditorDocument {
  const doc = upgradeWalkthroughDocument(input);
  const next = structuredClone(path);
  // Eliminar un punto del trayecto también retira su referencia editorial.
  if (next.storyboardWaypointIds) {
    const ids = new Set(next.waypoints.map((point) => point.id));
    next.storyboardWaypointIds = next.storyboardWaypointIds.filter((id) => ids.has(id));
  }
  if (next.storyboardImages) {
    next.storyboardImages = next.storyboardImages.filter((image) => next.storyboardWaypointIds?.includes(image.waypointId));
  }
  doc.walkthroughs = [...doc.walkthroughs!.filter((item) => item.id !== path.id), next];
  return parseEditorDocument(doc);
}
export function removeWalkthrough(input: EditorDocument, id: string): EditorDocument {
  const doc = parseEditorDocument(input);
  doc.walkthroughs = doc.walkthroughs?.filter((path) => path.id !== id);
  return parseEditorDocument(doc);
}
export function waypoint(point: Point): WalkthroughWaypoint {
  return { ...point, id: crypto.randomUUID(), eyeHeightMm: 1600, dwellMs: 0, speedMmPerS: 1000 };
}
