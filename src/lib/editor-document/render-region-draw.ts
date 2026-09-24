/**
 * Lógica pura del selector de zonas permitidas del render.
 *
 * El selector admite tres formas de marcar una zona (estancia completa, polígono
 * punto a punto y rectángulo) y todas acaban en el mismo contrato: un polígono
 * en MILÍMETROS del plano, de 3 a 20 vértices, como exige
 * `renderDesignOptionsSchema`. Aquí vive todo lo que se puede probar sin DOM:
 * cerrar el trazo, validarlo, simplificar contornos largos y saber sobre qué
 * estancia está el cursor.
 */
import { deriveRoomsSafe } from './rooms';
import { roomInteriorCameras } from './room-interior-cameras';
import {
  MAX_POLYGON_POINTS,
  MIN_POLYGON_POINTS,
  limitPolygonVertices,
  pointInPolygon,
  polygonSelfIntersects,
} from './polygon-tools';
import { footprint } from './spatial-properties';
import { isRampLanding } from './ramp-kind';
import { rampPartFootprint, rampParts } from './ramp-route';
import type { EditorDocument, Point } from './schema';

/** Máximo de zonas que admite el esquema de opciones de render. */
export const MAX_REGIONS = 12;

/** Modos de marcado del selector. */
export const REGION_MODES = ['room', 'polygon', 'rectangle'] as const;
export type RegionMode = (typeof REGION_MODES)[number];
export const REGION_MODE_LABELS: Record<RegionMode, string> = {
  room: 'Estancia',
  polygon: 'Punto a punto',
  rectangle: 'Rectángulo',
};
export const REGION_MODE_HINTS: Record<RegionMode, string> = {
  room: 'Pulsa dentro de una estancia, escalera o rampa',
  polygon: 'Pulsa para añadir vértices; cierra en el primero, con doble clic o con Intro',
  rectangle: 'Arrastra para marcar',
};

export interface RegionRoom {
  roomId: string;
  name: string;
  polygon: Point[];
}

/**
 * Estancias del plano con su contorno listo para usarse como zona: el nombre es
 * la etiqueta del plano (la misma que ve el usuario en las vistas interiores) y
 * el contorno viene acotado a los vértices que admite el esquema.
 */
export function planRegionRooms(doc?: EditorDocument): RegionRoom[] {
  if (!doc) return [];
  const cameras = roomInteriorCameras(doc);
  return deriveRoomsSafe(doc).map((room, index) => ({
    roomId: room.id,
    name: cameras.find((camera) => camera.roomId === room.id)?.name ?? `Estancia ${index + 1}`,
    polygon: limitPolygonVertices(room.boundary, MAX_POLYGON_POINTS),
  }));
}

/**
 * Escaleras, rampas y descansillos que NO caen dentro de ninguna estancia: sin
 * esto quedarían fuera de toda zona, porque no hay muros que los encierren. Cada
 * tramo de una rampa con recorrido es una huella propia, para poder marcar solo
 * el que interesa.
 */
export function planRegionAccesses(
  doc: EditorDocument | undefined,
  rooms: readonly RegionRoom[],
): RegionRoom[] {
  if (!doc) return [];
  const outside = (polygon: Point[]) => {
    const centre = {
      x: polygon.reduce((sum, point) => sum + point.x, 0) / polygon.length,
      y: polygon.reduce((sum, point) => sum + point.y, 0) / polygon.length,
    };
    return !rooms.some((room) => pointInPolygon(centre, room.polygon));
  };
  const entries: RegionRoom[] = [];
  (doc.stairs ?? []).forEach((stair, index) => {
    const polygon = footprint(stair);
    if (outside(polygon))
      entries.push({ roomId: stair.id, name: stair.name?.trim() || `Escalera ${index + 1}`, polygon });
  });
  (doc.ramps ?? []).forEach((ramp, index) => {
    const label = ramp.name?.trim() || `${isRampLanding(ramp) ? 'Descansillo' : 'Rampa'} ${index + 1}`;
    rampParts(ramp).forEach((part, partIndex) => {
      const polygon = rampPartFootprint(ramp, part);
      if (!outside(polygon)) return;
      entries.push({
        roomId: partIndex === 0 ? ramp.id : `${ramp.id}#${partIndex}`,
        name: partIndex === 0 ? label : `${label} · tramo ${partIndex + 1}`,
        polygon,
      });
    });
  });
  return entries;
}

/**
 * Todo lo que el modo «Estancia» admite marcar: las estancias del plano y, como
 * una parte más, los accesos verticales que no pertenecen a ninguna.
 */
export function planRegionAreas(doc?: EditorDocument): RegionRoom[] {
  const rooms = planRegionRooms(doc);
  return [...rooms, ...planRegionAccesses(doc, rooms)];
}

/** Estancia bajo el punto, o null fuera de toda estancia. La más pequeña gana en anidamientos. */
export function roomAtPoint(rooms: readonly RegionRoom[], point: Point): RegionRoom | null {
  const hits = rooms.filter((room) => pointInPolygon(point, room.polygon));
  if (!hits.length) return null;
  return hits.reduce((smallest, room) =>
    boundingArea(room.polygon) < boundingArea(smallest.polygon) ? room : smallest,
  );
}

function boundingArea(polygon: readonly Point[]): number {
  const xs = polygon.map((point) => point.x);
  const ys = polygon.map((point) => point.y);
  return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
}

/** Rectángulo a partir del arrastre, o null si es tan pequeño que fue un clic. */
export function rectanglePolygon(start: Point, end: Point, minSideMm: number): Point[] | null {
  const x1 = Math.min(start.x, end.x);
  const x2 = Math.max(start.x, end.x);
  const y1 = Math.min(start.y, end.y);
  const y2 = Math.max(start.y, end.y);
  if (x2 - x1 < minSideMm || y2 - y1 < minSideMm) return null;
  return [
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x2, y: y2 },
    { x: x1, y: y2 },
  ];
}

export type PolygonClosure =
  | { ok: true; polygon: Point[] }
  | { ok: false; reason: 'pocos-vertices' | 'autointerseccion' };

/**
 * Cierra el trazo punto a punto: comprueba el mínimo de vértices, rechaza los
 * contornos con lazos (el modelo no puede respetar un área que se cruza) y
 * simplifica los que pasan del máximo del esquema.
 */
export function closeDraftPolygon(points: readonly Point[]): PolygonClosure {
  if (points.length < MIN_POLYGON_POINTS) return { ok: false, reason: 'pocos-vertices' };
  const polygon = limitPolygonVertices(points, MAX_POLYGON_POINTS);
  if (polygonSelfIntersects(polygon)) return { ok: false, reason: 'autointerseccion' };
  return { ok: true, polygon };
}

/** ¿El punto cae sobre el primer vértice del trazo? Es el gesto de cerrar el polígono. */
export function closesOnFirstVertex(
  points: readonly Point[],
  point: Point,
  radiusMm: number,
): boolean {
  const first = points[0];
  if (!first || points.length < MIN_POLYGON_POINTS) return false;
  return Math.hypot(point.x - first.x, point.y - first.y) <= radiusMm;
}

/** Nombre libre para una zona nueva: nunca repite uno ya usado en la lista. */
export function uniqueRegionName(base: string, used: readonly string[]): string {
  const name = base.trim() || 'Zona permitida';
  if (!used.includes(name)) return name;
  for (let index = 2; index < 100; index++)
    if (!used.includes(`${name} ${index}`)) return `${name} ${index}`;
  return name;
}
