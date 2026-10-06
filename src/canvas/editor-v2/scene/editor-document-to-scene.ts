import { planObjects } from '@/lib/editor-document/boundary-types';
import type { EditorDocument, FloorFinish, Furniture, Point } from '@/lib/editor-document/schema';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { meters, type EditorScene, type SceneBox, type ScenePolygon, type ExteriorWall } from './types';
import { wallMeshes, junctionMeshes } from './wall-meshes';
import { openingMeshes } from './opening-meshes';
import { stairMeshes } from './stair-meshes';
import { rampMesh } from './ramp-meshes';
import { furnitureSpatial, localToWorld } from '@/lib/editor-document/spatial-properties';
import { furnitureVolumes } from '@/lib/editor-document/furniture-volumes';
import { floorMeshes, zoneTerrainPatches } from './floor-meshes';
import { curvedWallMeshes } from './curved-wall-meshes';
import { landingEntranceSurfaces } from '@/lib/editor-document/landing-entrance-surface';
import { walkableSurfaceFinish } from '@/lib/editor-document/floor-finishes';
import { layeredTerrainSurfaces } from '@/lib/editor-document/terrain-surfaces';
import { selectedWallSides } from '@/lib/editor-document/wall-bulk-appearance';
import { wallPoints } from '@/lib/editor-document/geometry';

/** A read-only projection: no proximity inference, recentering, revision bumps or migration. */
export function editorDocumentToScene(doc: EditorDocument, floorVoids: Point[][] = []): EditorScene {
  const warnings: string[] = [];
  let floors: ScenePolygon[] = [];
  let rooms: ReturnType<typeof deriveRooms> = [];
  const exteriorWalls: ExteriorWall[] = [];
  const visibleWalls = doc.walls.filter((wall) => !wall.hidden);
  const visibleDocument = { ...doc, walls: visibleWalls };
  const walls = visibleWalls.filter((w) => !w.curveHeightMm).flatMap((wall) => wallMeshes(doc, wall)), joins = junctionMeshes(visibleDocument);
  const curves = visibleWalls.flatMap((wall) => curvedWallMeshes(doc, wall));
  // The room graph and its floor cuts stay based on every boundary, including
  // a deliberately hidden delimiter. Only the returned wall meshes are hidden.
  const logicalWalls = doc.walls.filter((wall) => !wall.curveHeightMm).flatMap((wall) => wallMeshes(doc, wall));
  const logicalJoins = junctionMeshes(doc);
  const logicalCurves = doc.walls.flatMap((wall) => curvedWallMeshes(doc, wall));
  try {
    rooms = deriveRooms(doc);
    for (const room of rooms) room.wallIds.forEach((wallId, i) => {
      const wall = doc.walls.find((wall) => wall.id === wallId);
      if (wall?.hidden || wall?.classification === 'interior') return;
      if (wall?.classification !== 'exterior' && rooms.filter((r) => r.wallIds.includes(wallId)).length !== 1) return;
      if (exteriorWalls.some(item => item.sourceEntityId === wallId)) return;
      const a = doc.vertices.find((v) => v.id === room.vertexIds[i])!;
      const b = doc.vertices.find((v) => v.id === room.vertexIds[(i + 1) % room.vertexIds.length])!;
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      const face = wall?.classification === 'exterior' ? selectedWallSides(doc, wallId, 'exterior')[0] : null;
      const endpoints = face ? wallPoints(doc, wall!) : [a, b];
      const dx = endpoints[1]!.x - endpoints[0]!.x, dy = endpoints[1]!.y - endpoints[0]!.y, sign = face === 'left' ? -1 : 1;
      exteriorWalls.push({ sourceEntityId: wallId, x: meters((a.x + b.x) / 2), z: meters((a.y + b.y) / 2),
        normalX: dy / length * sign, normalZ: -dx / length * sign });
    });
    floors = floorMeshes(doc, rooms, logicalWalls, [...logicalJoins, ...logicalCurves], floorVoids);
  } catch (error) { warnings.push(error instanceof Error ? error.message : 'No se pudo cerrar el suelo.'); }
  const entrances: ScenePolygon[] = landingEntranceSurfaces(doc).map(({ openingId, landing, points }) => {
    const finish = { ...walkableSurfaceFinish(landing.materialId, landing.color),
      undersideTexture: landing.bodyMaterialId as FloorFinish['undersideTexture'] };
    return { id: `${openingId}:landing-surface`, sourceEntityId: landing.id, role: 'floor',
      points: points.map((p) => ({ x: meters(p.x), y: meters(p.y) })),
      elevation: 0, height: meters(landing.elevationMm) + .0005,
      color: finish.color, sideColor: landing.bodyMaterialId ? '#ffffff' : '#756f66', floorFinish: finish };
  });
  const terrain: ScenePolygon[] = layeredTerrainSurfaces(doc).map((surface, index) => ({
    id: surface.id, sourceEntityId: surface.id, role: 'floor',
    points: [{ x: meters(surface.x), y: meters(surface.y) },
      { x: meters(surface.x + surface.widthMm), y: meters(surface.y) },
      { x: meters(surface.x + surface.widthMm), y: meters(surface.y + surface.depthMm) },
      { x: meters(surface.x), y: meters(surface.y + surface.depthMm) }],
    elevation: -.05 + Math.min(index, 5) * .008, height: 0, color: surface.color,
    floorFinish: { roomId: surface.id, color: surface.color, texture: surface.texture,
      tileSizeMm: surface.tileSizeMm, rotation: surface.rotation },
  }));
  return { warnings, exteriorWalls, ramps: (doc.ramps ?? []).flatMap(rampMesh), polygons: [...terrain, ...zoneTerrainPatches(doc, rooms), ...floors, ...joins, ...curves, ...entrances], boxes: [
    ...walls, ...doc.openings.filter((opening) => !doc.walls.find((wall) => wall.id === opening.wallId)?.hidden).flatMap((o) => openingMeshes(doc, o)),
    ...(doc.stairs ?? []).flatMap(stairMeshes),
    ...(doc.columns ?? []).map((column) => ({ id: column.id, sourceEntityId: column.id, role: 'column' as const,
      position: [meters(column.x + column.widthMm / 2), meters(column.elevationMm + column.heightMm / 2), meters(column.y + column.depthMm / 2)] as [number, number, number],
      size: [meters(column.widthMm), meters(column.heightMm), meters(column.depthMm)] as [number, number, number],
      rotation: -column.rotation * Math.PI / 180, color: column.color ?? '#a6a6a0', materialId: column.materialId })),
    ...planObjects(doc).flatMap((f) => furnitureSceneBoxes(f, doc)),
  ] };
}

/** Sólidos con que la escena 3D pinta un objeto del plano sin modelo GLB; sin documento, los de la pieza suelta. */
export function furnitureSceneBoxes(f: Furniture, doc?: EditorDocument): SceneBox[] {
  return furnitureVolumes(f, doc).map((volume, index) => {
    const center = localToWorld({ ...volume, rotation: volume.rotation ?? 0 }, { x: volume.widthMm / 2, y: volume.depthMm / 2 });
    const p = localToWorld(f, center);
    return { id: index ? `${f.id}:${index}` : f.id, sourceEntityId: volume.gateId ?? volume.slotId ?? f.id, role: 'furniture' as const,
      position: [meters(p.x), meters((volume.bottom + volume.top) / 2), meters(p.y)] as [number, number, number],
      size: [meters(volume.widthMm), meters(volume.top - volume.bottom), meters(volume.depthMm)] as [number, number, number],
      ...(f.catalogId === 'habiteka:outdoor:tira-led' && index === 1 ? { emissive: '#ffe3ad' } : {}),
      shape: volume.shape, materialId: volume.materialId, useColorMap: volume.useColorMap,
      boundaryPart: volume.part, opacity: volume.opacity,
      appearance: volume.appearance,
      rotation: -(f.rotation + (volume.rotation ?? 0)) * Math.PI / 180, color: volume.color ?? furnitureSpatial(f).color };
  });
}
