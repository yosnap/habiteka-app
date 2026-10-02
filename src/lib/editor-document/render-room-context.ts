import type { EditorDocument } from './schema';
import type { RenderView } from './render-view';
import { roomInteriorCameras } from './room-interior-cameras';
import { deriveRoomsSafe } from './rooms';
import { designZoneRoomParts } from './design-zone-geometry';
import { polygonArea } from './geometry';
import { cameraPoseFromView } from '@/lib/contracts/walkthrough-keyframe';
import { sameCameraPose } from '@/lib/contracts/storyboard-image';

/** Identidad de la estancia de una captura, verificada sobre su documento original. */
export function renderRoomContext(doc: EditorDocument, view: RenderView) {
  if (view.preset !== 'custom' || view.allLevels) return null;
  let pose;
  try { pose = cameraPoseFromView(view); } catch { return null; }
  const camera = roomInteriorCameras(doc).find((item) => sameCameraPose(item.camera, pose));
  if (!camera) return null;
  const room = deriveRoomsSafe(doc).find((item) => item.id === camera.roomId);
  if (!room) return null;
  // Una estancia puede incluir varias zonas (salón y cocina). Solo cuenta una
  // zona contenida casi por completo; tocar su borde no demuestra cobertura.
  const zones = (doc.designZones ?? []).filter((zone) => {
    const area = Math.abs(polygonArea(zone.polygon));
    const covered = designZoneRoomParts(zone, room).reduce((sum, part) =>
      sum + Math.abs(polygonArea(part[0]!.map(([x, y]) => ({ x, y }))))
        - part.slice(1).reduce((holes, ring) => holes + Math.abs(polygonArea(ring.map(([x, y]) => ({ x, y })))), 0), 0);
    return area > 1 && covered / area >= 0.95;
  }).map(({ id, name }) => ({ id, name }));
  return { roomId: camera.roomId, roomName: camera.name, roomAreaM2: camera.areaM2, zones };
}
