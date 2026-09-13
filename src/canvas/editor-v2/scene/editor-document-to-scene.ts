import type { EditorDocument } from '@/lib/editor-document/schema';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { meters, type EditorScene, type ScenePolygon, type ExteriorWall } from './types';
import { wallMeshes, junctionMeshes } from './wall-meshes';
import { openingMeshes } from './opening-meshes';
import { stairMeshes } from './stair-meshes';
import { furnitureSpatial, localToWorld } from '@/lib/editor-document/spatial-properties';
import { furnitureVolumes } from '@/lib/editor-document/furniture-volumes';
import { floorMeshes } from './floor-meshes';
import { curvedWallMeshes } from './curved-wall-meshes';

/** A read-only projection: no proximity inference, recentering, revision bumps or migration. */
export function editorDocumentToScene(doc: EditorDocument): EditorScene {
  const warnings: string[] = [];
  let floors: ScenePolygon[] = [];
  const exteriorWalls: ExteriorWall[] = [];
  const walls = doc.walls.filter((w) => !w.curveHeightMm).flatMap((wall) => wallMeshes(doc, wall)), joins = junctionMeshes(doc);
  const curves = doc.walls.flatMap((wall) => curvedWallMeshes(doc, wall));
  try {
    const rooms = deriveRooms(doc);
    for (const room of rooms) room.wallIds.forEach((wallId, i) => {
      if (rooms.filter((r) => r.wallIds.includes(wallId)).length !== 1) return;
      const a = doc.vertices.find((v) => v.id === room.vertexIds[i])!;
      const b = doc.vertices.find((v) => v.id === room.vertexIds[(i + 1) % room.vertexIds.length])!;
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      exteriorWalls.push({ sourceEntityId: wallId, x: meters((a.x + b.x) / 2), z: meters((a.y + b.y) / 2),
        normalX: (b.y - a.y) / length, normalZ: -(b.x - a.x) / length });
    });
    floors = floorMeshes(doc, rooms, walls, [...joins, ...curves]);
  } catch (error) { warnings.push(error instanceof Error ? error.message : 'No se pudo cerrar el suelo.'); }
  return { warnings, exteriorWalls, polygons: [...floors, ...joins, ...curves], boxes: [
    ...walls, ...doc.openings.flatMap((o) => openingMeshes(doc, o)),
    ...(doc.stairs ?? []).flatMap(stairMeshes),
    ...doc.furniture.flatMap((f) => furnitureVolumes(f).map((volume, index) => {
      const p = localToWorld(f, { x: volume.x + volume.widthMm / 2, y: volume.y + volume.depthMm / 2 });
      return { id: index ? `${f.id}:${index}` : f.id, sourceEntityId: f.id, role: 'furniture' as const,
        position: [meters(p.x), meters((volume.bottom + volume.top) / 2), meters(p.y)] as [number, number, number],
        size: [meters(volume.widthMm), meters(volume.top - volume.bottom), meters(volume.depthMm)] as [number, number, number],
        rotation: -f.rotation * Math.PI / 180, color: volume.color ?? furnitureSpatial(f).color };
    })),
  ] };
}
