import { Box3, type Object3D } from 'three';
import type { ZoneMaskRegions } from '@/lib/editor-document/render-view';
import { clipDesignZone } from '@/lib/editor-document/design-zone-geometry';
import { polygonArea } from '@/lib/editor-document/geometry';
import { pointInPolygon } from '@/lib/editor-document/polygon-tools';

/** Holgura con la que una valla o seto del borde cuenta como parte de la zona: van sobre el límite, no dentro. */
const ZONE_EDGE_REACH_MM = 300;

/** Los muebles se conservan enteros cuando ocupan una parte significativa de la zona. */
export function furnitureBelongsToZone(object: Object3D, regions: ZoneMaskRegions): boolean {
  const box = new Box3().setFromObject(object);
  if (box.isEmpty()) return false;
  const minX = box.min.x * 1000, maxX = box.max.x * 1000;
  const minY = box.min.z * 1000, maxY = box.max.z * 1000;
  // Vallas, cercas y setos son el decorado del límite de la parcela y nunca se ocultan: basta con rozar la zona.
  if (object.userData.zoneEdge) return regions.some((region) => {
    const xs = region.map((point) => point.x), ys = region.map((point) => point.y);
    return maxX >= Math.min(...xs) - ZONE_EDGE_REACH_MM && minX <= Math.max(...xs) + ZONE_EDGE_REACH_MM
      && maxY >= Math.min(...ys) - ZONE_EDGE_REACH_MM && minY <= Math.max(...ys) + ZONE_EDGE_REACH_MM;
  });
  const center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  if (regions.some((region) => pointInPolygon(center, region))) return true;
  const area = (maxX - minX) * (maxY - minY);
  if (area < 1) return false;
  const footprint: [number, number][] = [
    [minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY],
  ];
  return regions.some((region) => {
    const overlap = clipDesignZone({ polygon: [...region] }, [footprint])
      .reduce((sum, polygon) => sum + Math.abs(polygonArea(
        polygon[0]!.map(([x, y]) => ({ x, y })),
      )), 0);
    return overlap / area >= 0.2;
  });
}

export function belongsToFurnitureGroup(object: Object3D): boolean {
  for (let parent: Object3D | null = object; parent; parent = parent.parent) {
    if (parent.userData.videoStage === 3) return true;
  }
  return false;
}

/** Apoyo estructural bajo un suelo elevado, conservado al abrir el muro en el alzado. */
export function cutawaySupportHeight(object: Object3D): number | undefined {
  for (let parent: Object3D | null = object; parent; parent = parent.parent) {
    const height = parent.userData.cutawaySupportHeightM;
    if (typeof height === 'number') return height;
  }
  return undefined;
}
