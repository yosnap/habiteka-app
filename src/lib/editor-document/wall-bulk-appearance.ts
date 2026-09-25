import type { EditorDocument, Wall } from './schema';
import { eligibleCeilingRooms } from './ceiling-geometry';
import type { DerivedRoom } from './rooms';
import { upgradeSpatialDocument } from './spatial-properties';
import { parseEditorDocument } from './validation';
import { surfaceMaterial } from './surface-materials';

export type WallFaceTarget = 'interior' | 'exterior' | 'both';
type Side = 'left' | 'right';

function sides(wall: Wall, rooms: DerivedRoom[], target: WallFaceTarget): Side[] {
  if (target === 'both') return ['left', 'right'];
  const adjacent = rooms.flatMap((room) => {
    const index = room.wallIds.indexOf(wall.id);
    return index < 0 ? [] : [room.vertexIds[index] === wall.startVertexId ? 'left' as const : 'right' as const];
  });
  if (adjacent.length !== 1) return [];
  return [target === 'interior' ? adjacent[0]! : adjacent[0] === 'left' ? 'right' : 'left'];
}

/** Las caras semánticas usan habitaciones interiores; un patio cuenta como exterior. */
export function selectedWallSides(doc: EditorDocument, wallId: string, target: WallFaceTarget): Side[] {
  const wall = doc.walls.find((item) => item.id === wallId);
  if (!wall) return [];
  try { return sides(wall, eligibleCeilingRooms(doc), target); } catch { return []; }
}

/** Edita una selección en una única revisión del documento y respeta la orientación de cada muro. */
export function updateSelectedWallFaces(
  input: EditorDocument,
  ids: string[],
  target: WallFaceTarget,
  patch: { color: string } | { materialId: string | undefined },
): EditorDocument {
  if ('materialId' in patch && patch.materialId && !surfaceMaterial(patch.materialId))
    throw new Error('Material desconocido');
  const rooms = target === 'both' ? [] : eligibleCeilingRooms(input);
  const changes = ids.map((id) => {
    const wall = input.walls.find((item) => item.id === id);
    if (!wall || wall.hidden) throw new Error('Muro no disponible');
    const faces = sides(wall, rooms, target);
    if (!faces.length) throw new Error('No se pudo identificar la cara del muro');
    return { id, faces };
  });
  const doc = upgradeSpatialDocument(input);
  for (const change of changes) {
    const wall = doc.walls.find((item) => item.id === change.id)!;
    for (const side of change.faces) {
      if ('color' in patch) wall.colors![side] = patch.color;
      else {
        wall.materials![side] = patch.materialId ?? 'plaster-white';
        wall.colors![side] = patch.materialId ? '#ffffff' : '#eeeae2';
      }
    }
  }
  return parseEditorDocument(doc);
}
