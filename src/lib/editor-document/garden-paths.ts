import type { EditorDocument, Furniture, Point } from './schema';
import { editDocument, newId } from '@/canvas/editor-v2/editing-operations';
import { OUTDOOR_CATALOG } from './outdoor-catalog';
import { upgradeSpatialDocument } from './spatial-properties';
import type { GardenPathMaterial } from './garden-path-materials';
export { GARDEN_PATH_MATERIALS } from './garden-path-materials';

export interface GardenPathOptions { material: GardenPathMaterial; widthMm: number; border: 'none' | 'left' | 'right' | 'both'; planting: 'none' | 'arbusto' | 'planta-exterior'; curb: boolean }
export const DEFAULT_GARDEN_PATH: GardenPathOptions = { material: 'losas', widthMm: 1200, border: 'none', planting: 'arbusto', curb: false };

/** Cada tramo se guarda como pavimento editable. Las plantas son entidades independientes y no se estiran. */
export function addGardenPathSegment(doc: EditorDocument, from: Point, to: Point, options: GardenPathOptions): EditorDocument {
  const length = Math.hypot(to.x - from.x, to.y - from.y), width = options.widthMm;
  if (length < 50 || length > 200000 || !Number.isFinite(length) || !Number.isFinite(width) || width < 300 || width > 10000)
    throw new Error('El camino necesita un ancho de 0,30 a 10 m y un tramo de al menos 5 cm.');
  const angle = Math.atan2(to.y - from.y, to.x - from.x), cos = Math.cos(angle), sin = Math.sin(angle);
  const at = (x: number, y: number) => ({ x: from.x + cos*x - sin*y, y: from.y + sin*x + cos*y });
  const entry = OUTDOOR_CATALOG.find((item) => item.kind === 'camino')!;
  const items: Furniture[] = [{ id: newId(), kind: 'camino', catalogId: `habiteka:outdoor:camino:${options.material}${options.curb ? '-bordillo' : ''}`,
    ...at(0, -width/2), rotation: angle*180/Math.PI, widthMm: length, depthMm: width,
    heightMm: entry.heightMm, elevationMm: 0, color: '#ffffff', dimensionalOrigin: 'physical' }];
  if (options.planting !== 'none' && options.border !== 'none') {
    const plant = OUTDOOR_CATALOG.find((item) => item.kind === options.planting)!;
    const size = options.planting === 'arbusto' ? 600 : 450, spacing = size + 200;
    const count = Math.floor(length / spacing);
    const sides = options.border === 'both' ? [-1, 1] : [options.border === 'left' ? 1 : -1];
    for (const side of sides) for (let i = 0; i < count; i++) {
      const center = at((i+.5)*length/count, side*(width/2+size/2+100));
      const rotation = (i*137.5)%360, radians = rotation*Math.PI/180;
      items.push({ id: newId(), kind: plant.kind, catalogId: plant.id,
        x: center.x-size/2*(Math.cos(radians)-Math.sin(radians)), y: center.y-size/2*(Math.sin(radians)+Math.cos(radians)),
        widthMm: size, depthMm: size, heightMm: size, elevationMm: 0, rotation,
        color: plant.color, dimensionalOrigin: 'physical' });
    }
  }
  return editDocument(upgradeSpatialDocument(doc), (next) => next.furniture.push(...items));
}
