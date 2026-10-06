import registry from './generated/furniture-collision-proxies.json';
import type { Furniture, EditorDocument } from './schema';
import type { FurnitureVolume } from './furniture-profiles';
import { furnitureVolumes } from './furniture-volumes';
import { furnitureModel } from './furniture-models';
import { furnitureSpatial } from './spatial-properties';
import { getFurnitureCatalogEntry } from './furniture-catalog';

interface Proxy { sha256: string; frontRotation: number; grid: number[]; cellMm: number; boxes: number[][] }
const proxies: Readonly<Record<string, Proxy>> = registry;
export function calibratedFurnitureProxy(item: Furniture): Proxy | undefined {
  const model = furnitureModel(item), proxy = model && proxies[model.key];
  return proxy && proxy.sha256 === model!.sha256 && proxy.frontRotation === model!.frontRotation ? proxy : undefined;
}
/** Escala los sólidos del mismo GLB visible: patas, tablero, asiento, respaldo y soportes intermedios. */
export function furnitureCollisionVolumes(item: Furniture, doc?: EditorDocument): FurnitureVolume[] {
  const proxy = calibratedFurnitureProxy(item);
  if (!proxy) {
    if (!['table', 'chair', 'bench'].includes(getFurnitureCatalogEntry(item.catalogId)?.profile ?? '') || !furnitureModel(item))
      return furnitureVolumes(item, doc);
    const spatial = furnitureSpatial(item);
    return [{ x: 0, y: 0, widthMm: item.widthMm, depthMm: item.depthMm,
      bottom: spatial.elevationMm, top: spatial.elevationMm + spatial.heightMm }];
  }
  const spatial = furnitureSpatial(item), scale = [item.widthMm / proxy.grid[0]!, item.depthMm / proxy.grid[1]!, spatial.heightMm / proxy.grid[2]!];
  return proxy.boxes.map(([x, y, z, w, d, h]) => ({ x: x! * scale[0]!, y: y! * scale[1]!,
    widthMm: w! * scale[0]!, depthMm: d! * scale[1]!, bottom: spatial.elevationMm + z! * scale[2]!,
    top: spatial.elevationMm + (z! + h!) * scale[2]! }));
}
