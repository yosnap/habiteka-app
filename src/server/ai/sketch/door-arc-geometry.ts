import type { SketchAperture, SketchPoint, SketchWall } from './sketch-types';

type ArcGeometry = NonNullable<SketchAperture['arcGeometry']>;

function point(value: unknown): SketchPoint | null {
  if (!value || typeof value !== 'object') return null;
  const { x, y } = value as Record<string, unknown>;
  return typeof x === 'number' && typeof y === 'number' &&
    Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= 1 && y >= 0 && y <= 1
    ? { x, y } : null;
}

/** Rechaza arcos imposibles para que tres puntos alucinados no coloquen una puerta. */
export function validDoorArcGeometry(value: unknown, imageHeightOverWidth = 1): ArcGeometry | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const hinge = point(raw.hinge);
  const openingEnd = point(raw.openingEnd);
  const arcPoint = point(raw.arcPoint);
  if (!hinge || !openingEnd || !arcPoint) return null;
  // Las coordenadas son 0–1 en cada eje: una imagen vertical no tiene píxeles
  // cuadrados en ese espacio. Comprobar el radio sin corregir la proporción
  // acepta arcos imposibles y rechaza otros reales.
  const aspect = Number.isFinite(imageHeightOverWidth) && imageHeightOverWidth > 0
    ? imageHeightOverWidth : 1;
  const dx = openingEnd.x - hinge.x;
  const dy = (openingEnd.y - hinge.y) * aspect;
  const width = Math.hypot(dx, dy);
  const arcRadius = Math.hypot(arcPoint.x - hinge.x, (arcPoint.y - hinge.y) * aspect);
  const cross = dx * (arcPoint.y - hinge.y) * aspect - dy * (arcPoint.x - hinge.x);
  if (width < 0.025 || width > 0.2 ||
    Math.min(Math.abs(dx), Math.abs(dy)) > width * 0.2 ||
    arcRadius < width * 0.65 || arcRadius > width * 1.35 ||
    Math.abs(cross) / width < 0.01) return null;
  return { hinge, openingEnd, arcPoint };
}

/** Un arco observado debe apoyar su vano en alguna pared paralela de la lectura. */
export function doorArcAlignedToWall(
  value: unknown, walls: SketchWall[], imageHeightOverWidth = 1,
): boolean {
  const arc = validDoorArcGeometry(value, imageHeightOverWidth);
  if (!arc) return false;
  const dx = arc.openingEnd.x - arc.hinge.x, dy = arc.openingEnd.y - arc.hinge.y;
  const length = Math.hypot(dx, dy);
  const center = { x: (arc.hinge.x + arc.openingEnd.x) / 2,
    y: (arc.hinge.y + arc.openingEnd.y) / 2 };
  return walls.some((wall) => {
    const wx = wall.x2 - wall.x1, wy = wall.y2 - wall.y1;
    const wallLength = Math.hypot(wx, wy);
    if (!wallLength || Math.abs((dx * wx + dy * wy) / (length * wallLength)) < 0.85) return false;
    const x = center.x - wall.x1, y = center.y - wall.y1;
    const position = (x * wx + y * wy) / (wallLength * wallLength);
    const distance = Math.abs(x * wy - y * wx) / wallLength;
    return position >= -0.05 && position <= 1.05 && distance <= 0.014;
  });
}

/** En una lectura nueva con puntos de arco, las puertas sin ellos son hipótesis. */
export function credibleDoorArc(
  aperture: SketchAperture, all: SketchAperture[], walls: SketchWall[], imageHeightOverWidth = 1,
): boolean {
  if (!aperture.arcGeometry) return !all.some((item) => item.tipo === 'puerta' && item.arcGeometry);
  return doorArcAlignedToWall(aperture.arcGeometry, walls, imageHeightOverWidth);
}

export function observedDoorArc(aperture: SketchAperture, imageHeightOverWidth = 1): {
  center: SketchPoint;
  widthUnit: number;
  sourceDirection: SketchPoint;
  swing: 'left' | 'right';
  hinge: 'left';
} | null {
  if (aperture.tipo !== 'puerta') return null;
  const arc = validDoorArcGeometry(aperture.arcGeometry, imageHeightOverWidth);
  if (!arc) return null;
  const dx = arc.openingEnd.x - arc.hinge.x;
  const dy = arc.openingEnd.y - arc.hinge.y;
  const widthUnit = Math.hypot(dx, dy);
  const cross = dx * (arc.arcPoint.y - arc.hinge.y) - dy * (arc.arcPoint.x - arc.hinge.x);
  return {
    center: { x: (arc.hinge.x + arc.openingEnd.x) / 2, y: (arc.hinge.y + arc.openingEnd.y) / 2 },
    widthUnit,
    sourceDirection: { x: dx / widthUnit, y: dy / widthUnit },
    swing: cross > 0 ? 'left' : 'right',
    hinge: 'left',
  };
}
