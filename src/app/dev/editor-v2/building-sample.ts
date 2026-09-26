import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { addBuildingLevel, switchBuildingLevel } from '@/lib/editor-document/building-levels';
import { setRoomCeiling } from '@/lib/editor-document/ceiling-commands';
import { addStair } from '@/lib/editor-document/construction-commands';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { emptyEditorDocument } from '@/lib/editor-document/schema';

/** Edificio sintético para comprobar hueco, escalera y cambio de planta sin datos de proyecto. */
export function buildingSampleDocument() {
  const room = addWallPath(emptyEditorDocument(), [
    { x: 0, y: 0 }, { x: 6000, y: 0 }, { x: 6000, y: 4000 }, { x: 0, y: 4000 },
  ], true);
  const ceiling = setRoomCeiling(room, deriveRooms(room)[0]!.id);
  const upper = addBuildingLevel(ceiling, true);
  const lower = switchBuildingLevel(upper, upper.levels![0]!.id);
  return addStair(lower, { id: 'sample-stair', kind: 'straight', catalogId: 'stair-straight',
    x: 1000, y: 1000, widthMm: 1000, depthMm: 2500, heightMm: 2700,
    elevationMm: 0, rotation: 0, stepCount: 15, materialId: 'wood-oak' });
}
