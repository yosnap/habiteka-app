import polygonClipping, { type Polygon, type Pair } from 'polygon-clipping';
import type { EditorDocument, Point } from '@/lib/editor-document/schema';
import type { DerivedRoom } from '@/lib/editor-document/rooms';
import { meters, type SceneBox, type ScenePolygon } from './types';
import { floorFinish, floorSlabThicknessMm } from '@/lib/editor-document/floor-finishes';
import { rampPartFootprint, rampParts } from '@/lib/editor-document/ramp-route';
import { rampArrival, rampArrivalTarget } from '@/lib/editor-document/ramp-arrival';
import { isRampLanding } from '@/lib/editor-document/ramp-kind';
import { surfaceMaterial } from '@/lib/editor-document/surface-materials';
import { clipDesignZone } from '@/lib/editor-document/design-zone-geometry';
import { layeredTerrainSurfaces } from '@/lib/editor-document/terrain-surfaces';

// Trigonometry introduces sub-nanometer slivers at shared edges (e.g. cos(π/2)).
// Give the boolean operation one common 0.00001 mm grid, far below editor precision.
const clean = (polygon: Polygon): Polygon => polygon.map((ring) => ring.map(([x, y]) =>
  [Math.round(x * 1e8) / 1e8, Math.round(y * 1e8) / 1e8]));

// Malla más gruesa (0,1 mm) para el reintento: colapsa las láminas que hacen fallar a la librería de recorte.
const coarse = (polygon: Polygon): Polygon => polygon.map((ring) => ring.map(([x, y]) =>
  [Math.round(x * 1e4) / 1e4, Math.round(y * 1e4) / 1e4]));

type Difference = (subject: Polygon, ...clips: Polygon[]) => Polygon[];

/**
 * Recorte del suelo con degradación por pasos: la librería de polígonos falla a veces con bordes casi colineales
 * («Unable to complete output ring»). Antes de renunciar se reintenta con una malla más gruesa y después
 * descartando solo el recorte problemático; en el peor caso se devuelve el suelo sin recortar. Así un caso
 * límite deja un hueco de pared sin recortar, nunca una escena 3D sin suelos.
 */
export function robustDifference(outline: Polygon, cuts: Polygon[], difference: Difference = polygonClipping.difference): Polygon[] {
  if (!cuts.length) return [outline];
  const attempt = (subject: Polygon, clips: Polygon[]) => { try { return difference(subject, ...clips); } catch { return null; } };
  const exact = attempt(clean(outline), cuts.map(clean));
  if (exact) return exact;
  const rough = attempt(coarse(outline), cuts.map(coarse));
  if (rough) return rough;
  let result: Polygon[] = [coarse(outline)];
  for (const cut of cuts.map(coarse)) {
    const next = result.flatMap((polygon) => attempt(polygon, [cut]) ?? [polygon]);
    result = next;
  }
  return result;
}

/** An elevated room is a structural volume, not a floating texture plane. */
export function floorMeshes(doc: EditorDocument, rooms: DerivedRoom[], walls: SceneBox[], joins: ScenePolygon[], voids: Point[][] = []): ScenePolygon[] {
  const obstaclesAt = (elevation: number): Polygon[] => {
    const obstacles = walls.filter((wall) => wall.position[1] - wall.size[1] / 2 <= elevation + 1e-7 &&
      wall.position[1] + wall.size[1] / 2 > elevation + 1e-7).map((wall) => {
      const angle = -wall.rotation, c = Math.cos(angle), s = Math.sin(angle);
      const [width, , depth] = wall.size;
      return [[[-width / 2, -depth / 2], [width / 2, -depth / 2], [width / 2, depth / 2], [-width / 2, depth / 2]]
        .map(([x, y]) => [wall.position[0] + x! * c - y! * s, wall.position[2] + x! * s + y! * c] as Pair)];
    });
    for (const join of joins.filter((item) => item.elevation <= elevation + 1e-7 && item.elevation + item.height > elevation + 1e-7))
      obstacles.push([join.points.map((point) => [point.x, point.y])]);
    return obstacles;
  };
  return rooms.flatMap((room) => {
    const outline: Polygon = [room.boundary.map((p) => [meters(p.x), meters(p.y)])];
    const finish = floorFinish(doc, room.id), surfaceElevation = meters(finish.elevationMm ?? 0);
    const obstacles = obstaclesAt(surfaceElevation);
    const rampAccesses = (doc.ramps ?? []).flatMap((ramp) => {
      if (isRampLanding(ramp)) return [];
      const target = rampArrivalTarget(doc, ramp), arrival = rampArrival(ramp);
      if (target?.room.id !== room.id || Math.abs(arrival.elevationMm - (finish.elevationMm ?? 0)) > 1) return [];
      const part = rampParts(ramp).filter((item) => item.kind === 'flight').at(-1)!;
      return [[rampPartFootprint(ramp, part).map((point) => [meters(point.x), meters(point.y)] as Pair)]];
    });
    const cuts = [...obstacles, ...rampAccesses,
      ...voids.map((voidOutline): Polygon => [voidOutline.map((point) => [meters(point.x), meters(point.y)] as Pair)])];
    const polygons = robustDifference(outline, cuts);
    const slabHeight = meters(floorSlabThicknessMm(finish));
    const floors: ScenePolygon[] = polygons.map((rings, index) => ({
      id: index ? `${room.id}:surface:${index}` : room.id, sourceEntityId: room.id, role: 'floor' as const,
      points: rings[0]!.map(([x, y]) => ({ x, y })),
      holes: rings.slice(1).map((ring) => ring.map(([x, y]) => ({ x, y }))),
      elevation: surfaceElevation - slabHeight, height: slabHeight, color: finish.color, floorFinish: finish,
      sideColor: finish.undersideColor ?? (surfaceMaterial(finish.undersideTexture) ? '#ffffff' : '#756f66'),
    }));
    // Los acabados parciales son una capa visual sobre el suelo estructural; no
    // modifican cota, espesor ni superficie transitable del recorrido.
    const patches: ScenePolygon[] = (doc.designZones ?? []).flatMap((zone, zoneIndex) => {
      if (!zone.floorFinish) return [];
      const scaled = { polygon: zone.polygon.map((point) => ({ x: meters(point.x), y: meters(point.y) })) };
      return polygons.flatMap((base, baseIndex) => clipDesignZone(scaled, base).map((piece, pieceIndex) => ({
        id: `${zone.id}:floor:${room.id}:${baseIndex}:${pieceIndex}`, sourceEntityId: room.id, role: 'floor' as const,
        points: piece[0]!.map(([x, y]) => ({ x, y })),
        holes: piece.slice(1).map((ring) => ring.map(([x, y]) => ({ x, y }))),
        elevation: surfaceElevation + .002 + zoneIndex * .0002, height: 0, color: zone.floorFinish!.color,
        floorFinish: { ...zone.floorFinish!, roomId: room.id },
      })));
    });
    return [...floors, ...patches];
  });
}

/** Acabado visual de zonas exteriores: queda bajo los suelos construidos y no habilita el recorrido. */
export function zoneTerrainPatches(doc: EditorDocument, rooms: DerivedRoom[]): ScenePolygon[] {
  const zones = (doc.designZones ?? []).filter((zone) => zone.floorFinish && zone.polygon.length >= 3);
  const terrains = layeredTerrainSurfaces(doc);
  if (!zones.length || !terrains.length) return [];
  const rectangles: Polygon[] = terrains.map((surface) => [[
    [meters(surface.x), meters(surface.y)],
    [meters(surface.x + surface.widthMm), meters(surface.y)],
    [meters(surface.x + surface.widthMm), meters(surface.y + surface.depthMm)],
    [meters(surface.x), meters(surface.y + surface.depthMm)],
  ]]);
  let terrainArea: ReturnType<typeof polygonClipping.union>;
  try { terrainArea = rectangles.length === 1 ? [rectangles[0]!] :
    polygonClipping.union(rectangles[0]!, rectangles[1]!, ...rectangles.slice(2)); } catch { return []; }
  const roomAreas: Polygon[] = rooms.map((room) => [room.boundary.map((point) => [meters(point.x), meters(point.y)] as Pair)]);
  return zones.flatMap((zone) => {
    const outline: Polygon = [zone.polygon.map((point) => [meters(point.x), meters(point.y)] as Pair)];
    const outsideRooms = robustDifference(outline, roomAreas);
    return outsideRooms.flatMap((piece, partIndex) => {
      let clipped: ReturnType<typeof polygonClipping.intersection>;
      try { clipped = polygonClipping.intersection(piece, terrainArea); } catch { return []; }
      return clipped.map((rings, index) => ({
        id: `${zone.id}:terrain:${partIndex}:${index}`, sourceEntityId: zone.id, role: 'floor' as const,
        points: rings[0]!.map(([x, y]) => ({ x, y })),
        holes: rings.slice(1).map((ring) => ring.map(([x, y]) => ({ x, y }))),
        elevation: -.001, height: 0, color: zone.floorFinish!.color,
        floorFinish: { ...zone.floorFinish!, roomId: zone.id },
      }));
    });
  });
}
