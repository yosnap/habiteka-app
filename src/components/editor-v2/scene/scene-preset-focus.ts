import type { EditorDocument } from '@/lib/editor-document/schema';
import type { CameraRequest, SceneCameraPreset } from './scene-camera';

/** Encuadra la construcción; los muebles exteriores alejados no reducen la casa a una miniatura. */
export function scenePresetFocus(
  document: EditorDocument,
  preset: SceneCameraPreset,
  elevationMm = 0,
): CameraRequest['focus'] | undefined {
  if (preset === 'top' || preset === 'isometric') return undefined;
  const vertices = new Map(document.vertices.map((vertex) => [vertex.id, vertex]));
  const walls = document.walls.filter((wall) => !wall.hidden);
  const points = walls.flatMap((wall) => [vertices.get(wall.startVertexId), vertices.get(wall.endVertexId)])
    .filter((point): point is NonNullable<typeof point> => Boolean(point));
  if (points.length < 2) return undefined;

  const xMin = Math.min(...points.map((point) => point.x));
  const xMax = Math.max(...points.map((point) => point.x));
  const zMin = Math.min(...points.map((point) => point.y));
  const zMax = Math.max(...points.map((point) => point.y));
  const lowMm = Math.min(0, ...walls.map((wall) => wall.baseElevationMm ?? 0));
  const highMm = Math.max(2800, ...walls.map((wall) => (wall.baseElevationMm ?? 0) + (wall.heightMm ?? 2800)));
  // El dron conserva algo más de contexto alrededor del edificio.
  const padding = preset === 'drone' ? 1.7 : 1.55;
  return {
    center: [(xMin + xMax) / 2000, (elevationMm + (lowMm + highMm) / 2) / 1000, (zMin + zMax) / 2000],
    size: [Math.max(1, (xMax - xMin) / 1000) * padding,
      Math.max(2, (highMm - lowMm) / 1000) * padding,
      Math.max(1, (zMax - zMin) / 1000) * padding],
  };
}
