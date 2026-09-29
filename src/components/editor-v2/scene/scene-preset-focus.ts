import type { EditorDocument } from '@/lib/editor-document/schema';
import type { ZoneMaskRegions } from '@/lib/editor-document/render-view';
import type { CameraRequest, SceneCameraPreset } from './scene-camera';

/** El área seleccionada llena la cámara sin incluir el resto de la finca. */
export function sceneZoneFocus(regions: ZoneMaskRegions, elevationMm = 0): CameraRequest['focus'] | undefined {
  const points = regions.flat();
  if (!points.length) return undefined;
  const xs = points.map((point) => point.x), ys = points.map((point) => point.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  return { center: [(minX + maxX) / 2000, (elevationMm + 1500) / 1000, (minY + maxY) / 2000],
    size: [Math.max(2, (maxX - minX) / 1000) * 1.25, 3.5, Math.max(2, (maxY - minY) / 1000) * 1.25] };
}

/** En zonas alargadas, la cámara oblicua mira desde el lateral largo. */
export function zoneObliqueDirection(
  focus: NonNullable<CameraRequest['focus']>,
  preset: 'isometric' | 'drone',
): [number, number, number] | undefined {
  const [width, , depth] = focus.size;
  const height = preset === 'drone' ? 1.35 : 1;
  if (depth > width * 1.6) return [1, height, .28];
  if (width > depth * 1.6) return [.28, height, 1];
  return undefined;
}

/** Encuadra la construcción; el dron incorpora el agua cercana sin abarcar objetos remotos. */
export function scenePresetFocus(
  document: EditorDocument,
  preset: SceneCameraPreset,
  elevationMm = 0,
): CameraRequest['focus'] | undefined {
  if (preset === 'top') return undefined;
  const vertices = new Map(document.vertices.map((vertex) => [vertex.id, vertex]));
  const walls = document.walls.filter((wall) => !wall.hidden);
  const points = walls.flatMap((wall) => [vertices.get(wall.startVertexId), vertices.get(wall.endVertexId)])
    .filter((point): point is NonNullable<typeof point> => Boolean(point));
  if (points.length < 2) return undefined;

  let xMin = Math.min(...points.map((point) => point.x));
  let xMax = Math.max(...points.map((point) => point.x));
  let zMin = Math.min(...points.map((point) => point.y));
  let zMax = Math.max(...points.map((point) => point.y));
  let includesWater = false;
  if (preset === 'drone') {
    const reach = Math.max(xMax - xMin, zMax - zMin) * .75;
    const wallBounds = { xMin, xMax, zMin, zMax };
    for (const item of document.furniture) {
      if (item.kind !== 'piscina' && item.kind !== 'estanque') continue;
      const angle = item.rotation * Math.PI / 180;
      const halfX = (Math.abs(Math.cos(angle)) * item.widthMm + Math.abs(Math.sin(angle)) * item.depthMm) / 2;
      const halfZ = (Math.abs(Math.sin(angle)) * item.widthMm + Math.abs(Math.cos(angle)) * item.depthMm) / 2;
      if (item.x - halfX > wallBounds.xMax + reach || item.x + halfX < wallBounds.xMin - reach ||
        item.y - halfZ > wallBounds.zMax + reach || item.y + halfZ < wallBounds.zMin - reach) continue;
      xMin = Math.min(xMin, item.x - halfX);
      xMax = Math.max(xMax, item.x + halfX);
      zMin = Math.min(zMin, item.y - halfZ);
      zMax = Math.max(zMax, item.y + halfZ);
      includesWater = true;
    }
  }
  const lowMm = Math.min(0, ...walls.map((wall) => wall.baseElevationMm ?? 0));
  const highMm = Math.max(2800, ...walls.map((wall) => (wall.baseElevationMm ?? 0) + (wall.heightMm ?? 2800)));
  // La isométrica prioriza la casa; el dron muestra además el agua próxima.
  const padding = preset === 'isometric' ? 1.2
    : preset === 'drone' ? (includesWater ? 1.35 : 1.7) : 1.55;
  return {
    center: [(xMin + xMax) / 2000, (elevationMm + (lowMm + highMm) / 2) / 1000, (zMin + zMax) / 2000],
    size: [Math.max(1, (xMax - xMin) / 1000) * padding,
      Math.max(2, (highMm - lowMm) / 1000) * padding,
      Math.max(1, (zMax - zMin) / 1000) * padding],
  };
}
