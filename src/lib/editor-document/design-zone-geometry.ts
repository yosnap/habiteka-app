import polygonClipping, { type Polygon, type Pair } from 'polygon-clipping';
import type { DesignZone, Point } from './schema';
import type { DerivedRoom } from './rooms';
import { polygonArea } from './geometry';
import { footprint } from './spatial-properties';
import type { EditorDocument } from './schema';

const ring = (points: readonly Point[]): Pair[] => points.map((point) => [point.x, point.y]);

/** Recorta una zona a un suelo real; los contornos no crean superficie transitable. */
export function clipDesignZone(zone: Pick<DesignZone, 'polygon'>, boundary: Polygon): Polygon[] {
  try { return polygonClipping.intersection([ring(zone.polygon)], boundary); }
  catch { return []; }
}

export function designZoneRoomParts(zone: Pick<DesignZone, 'polygon'>, room: DerivedRoom): Polygon[] {
  return clipDesignZone(zone, [ring(room.boundary)]);
}

export function designZoneRooms(zone: Pick<DesignZone, 'polygon'>, rooms: readonly DerivedRoom[]): DerivedRoom[] {
  return rooms.filter((room) => designZoneRoomParts(zone, room).some((part) =>
    Math.abs(polygonArea(part[0]!.map(([x, y]) => ({ x, y })))) > 1));
}

export function designZonesOverlap(a: Pick<DesignZone, 'polygon'>, b: Pick<DesignZone, 'polygon'>): boolean {
  return clipDesignZone(a, [ring(b.polygon)]).some((part) =>
    Math.abs(polygonArea(part[0]!.map(([x, y]) => ({ x, y })))) > 1);
}

/** Una zona de entrada también puede abarcar un acceso exterior sin suelo de estancia. */
export function designZoneStructures(zone: Pick<DesignZone, 'polygon'>, doc: EditorDocument): string[] {
  return [...(doc.stairs ?? []), ...(doc.ramps ?? [])].filter((item) =>
    clipDesignZone(zone, [ring(footprint(item))]).some((part) =>
      Math.abs(polygonArea(part[0]!.map(([x, y]) => ({ x, y })))) > 1)).map((item) => item.id);
}
