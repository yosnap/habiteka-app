import type { Object3D } from 'three';
import type { EditorDocument } from '@/lib/editor-document/schema';

/** La zona se dibuja sobre el eje del muro; la fachada y el alero quedan fuera de ese eje. */
export function exteriorZoneMarginMm(document: EditorDocument): number {
  const halfWall = Math.max(0, ...document.walls.filter(wall => !wall.hidden).map(wall => wall.thicknessMm / 2));
  return halfWall + (document.exteriorRoof?.eavesMm ?? 0) + 50;
}

/** Solo la estructura recibe margen: suelo, parcela y muebles no amplían su ámbito. */
export function belongsToZoneStructure(object: Object3D): boolean {
  for (let current: Object3D | null = object; current; current = current.parent)
    if (current.userData.cutawayStructural || current.userData.cutawayWallId || current.userData.roofLayer) return true;
  return false;
}
