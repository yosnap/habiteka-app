import type { EditorDocument, DesignZone, Point } from '@/lib/editor-document/schema';
import type { DerivedRoom } from '@/lib/editor-document/rooms';
import { editorDesignContext } from '@/lib/editor-document/design-context';
import { distanceToSegment, pointInPolygon } from '@/lib/editor-document/polygon-tools';
import { designZoneRoomParts, designZoneStructures } from '@/lib/editor-document/design-zone-geometry';
import { polygonArea } from '@/lib/editor-document/geometry';
import { wallPath } from '@/lib/editor-document/wall-path';

/** Contorno efectivo dentro de una estancia abierta; nunca devuelve la otra zona de esa estancia. */
export function zoneRoomOutline(zone: DesignZone, room: DerivedRoom): Point[] {
  const parts = designZoneRoomParts(zone, room).map((part) => part[0]!.map(([x, y]) => ({ x, y })));
  return parts.sort((a, b) => Math.abs(polygonArea(b)) - Math.abs(polygonArea(a)))[0] ?? [];
}

/** Contexto visual de una sola zona: la paleta sigue siendo global para mantener coherencia. */
export function zoneDesignContext(document: EditorDocument, zone: DesignZone, rooms: DerivedRoom[]) {
  const context = editorDesignContext(document);
  const level = context.levels.find((item) => item.id === document.activeLevelId) ?? context.levels[0];
  if (!level) return context;
  const ids = new Set(rooms.map((room) => room.id));
  const outlines = new Map(rooms.map((room) => [room.id, zoneRoomOutline(zone, room)]));
  const meters = (boundary: Point[]) => boundary.map((point) => ({
    x: Number((point.x / 1000).toFixed(3)), y: Number((point.y / 1000).toFixed(3)),
  }));
  const nearZone = (point: Point, marginMm = 100) => pointInPolygon(point, zone.polygon)
    || zone.polygon.some((start, index) => distanceToSegment(point, start, zone.polygon[(index + 1) % zone.polygon.length]!) <= marginMm);
  const wallTouchesZone = (path: typeof level.walls[number]['pathM']) => path.slice(1).some((end, index) => {
    const start = path[index]!;
    const count = Math.max(1, Math.ceil(Math.hypot(end.x - start.x, end.y - start.y) * 4));
    for (let step = 0; step <= count; step++) {
      const ratio = step / count;
      if (nearZone({ x: (start.x + (end.x - start.x) * ratio) * 1000,
        y: (start.y + (end.y - start.y) * ratio) * 1000 })) return true;
    }
    return false;
  });
  const walls = level.walls.filter((wall) => wallTouchesZone(wall.pathM));
  const wallIds = new Set(walls.map((wall) => wall.id));
  const structureIds = new Set(designZoneStructures(zone, document));
  const inside = (x: number, y: number) => pointInPolygon({ x: x * 1000, y: y * 1000 }, zone.polygon);
  return { ...context, levels: [{
    id: level.id, elevationM: level.elevationM, designStyle: level.designStyle,
    rooms: level.rooms.filter((room) => ids.has(room.id)).map((room) => {
      const outline = outlines.get(room.id) ?? [];
      return { ...room, boundaryM: meters(outline), areaM2: Number((Math.abs(polygonArea(outline)) / 1e6).toFixed(2)) };
    }),
    floors: level.floors.filter((floor) => ids.has(floor.roomId)).map((floor) => ({
      ...floor, boundaryM: meters(outlines.get(floor.roomId) ?? []),
    })),
    designZones: level.designZones.filter((item) => item.id === zone.id),
    walls, openings: level.openings.filter((opening) => {
      const wall = document.walls.find((item) => item.id === opening.wallId);
      return wallIds.has(opening.wallId) && Boolean(wall)
        && nearZone(wallPath(document, wall!).at(opening.position), 150);
    }),
    columns: level.columns.filter((item) => nearZone({ x: item.positionM.x * 1000, y: item.positionM.y * 1000 })),
    stairs: level.stairs.filter((item) => structureIds.has(item.id)),
    ramps: level.ramps.filter((item) => structureIds.has(item.id)),
    furniture: level.furniture.filter((item) => inside(
      item.positionM.x + item.dimensionsM.width / 2,
      item.positionM.y + item.dimensionsM.depth / 2,
    )),
  }] };
}
