import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { setExteriorRoof } from '@/lib/editor-document/exterior-roof';
import { putWalkthrough, waypoint } from '@/lib/editor-document/walkthrough';

/** Exportación sintética local: no modifica ni aprueba proyectos. */
export function constructionSampleDocument() {
  const room = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 6000, y: 0 }, { x: 6000, y: 4000 }, { x: 0, y: 4000 }], true);
  const roof = setExteriorRoof(room, { kind: 'hip', pitchDeg: 25 });
  return putWalkthrough(roof, { id: 'construction-sample-route', name: 'Comprobación de exportación', zoneIds: [], loop: false,
    waypoints: [waypoint({ x: 1500, y: 2000 }), waypoint({ x: 4500, y: 2000 })] });
}
