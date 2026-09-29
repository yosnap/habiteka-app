import { planObjects } from '@/lib/editor-document/boundary-types';
import { getFurnitureCatalogEntry } from '@/lib/editor-document/furniture-catalog';
import { canPlaceNativeDesignFurniture, type NativeDesignFurniture } from '@/lib/editor-document/native-design-proposal';
import { isSurfaceHost } from '@/lib/editor-document/object-host-rest';
import { allowedProposalCatalog, allowedProposalFurniture } from '@/lib/editor-document/proposal-permissions';
import { deriveRooms, type DerivedRoom } from '@/lib/editor-document/rooms';
import { localToWorld } from '@/lib/editor-document/spatial-properties';
import type { EditorDocument, Point } from '@/lib/editor-document/schema';
import type { RenderDesignOptions } from '@/lib/editor-document/render-design-options';

/** Posiciones reales de luz que la propuesta puede usar sin inventar espacio ni soportes. */
export function lightPlacementHints(doc: EditorDocument, selectedRooms: DerivedRoom[], zone: Point[] | undefined,
  options: RenderDesignOptions): string {
  const table = getFurnitureCatalogEntry('habiteka:furniture:lampara-mesa');
  const standing = getFurnitureCatalogEntry('habiteka:furniture:lampara-pie');
  if (!table || !standing || !allowedProposalCatalog(table, options)) return '';
  const rooms = deriveRooms(doc), allowed = new Set(selectedRooms.map((room) => room.id));
  const valid = (item: NativeDesignFurniture) => allowedProposalFurniture(item, options, zone)
    && canPlaceNativeDesignFurniture(doc, item, rooms, allowed, zone);
  const suggestions: NativeDesignFurniture[] = [];
  const hostOffsets: [number, number][] = [[.5, .5], [.2, .2], [.8, .8]];
  for (const host of planObjects(doc).filter(isSurfaceHost)) {
    for (const [fx, fy] of hostOffsets) {
      const origin = localToWorld(host, {
        x: (host.widthMm - table.widthMm) * fx,
        y: (host.depthMm - table.depthMm) * fy,
      });
      const item = { catalogId: table.id, xMm: Math.round(origin.x), yMm: Math.round(origin.y),
        rotation: host.rotation, reason: 'Luz de apoyo sobre una superficie existente' };
      if (valid(item) && !suggestions.some((previous) => previous.catalogId === item.catalogId
        && Math.hypot(previous.xMm - item.xMm, previous.yMm - item.yMm) < 500)) suggestions.push(item);
      if (suggestions.length >= 3) break;
    }
    if (suggestions.length >= 3) break;
  }
  if (allowedProposalCatalog(standing, options)) {
    let scanned = 0;
    for (const room of selectedRooms) {
      const outline = zone ?? room.boundary;
      const minX = Math.min(...outline.map((p) => p.x)), maxX = Math.max(...outline.map((p) => p.x));
      const minY = Math.min(...outline.map((p) => p.y)), maxY = Math.max(...outline.map((p) => p.y));
      let found = false;
      for (let x = Math.ceil(minX / 500) * 500; x + standing.widthMm <= maxX && !found && scanned < 240; x += 500)
        for (let y = Math.ceil(minY / 500) * 500; y + standing.depthMm <= maxY && scanned < 240; y += 500) {
          scanned++;
          const item = { catalogId: standing.id, xMm: x, yMm: y, rotation: 0, reason: 'Luz ambiental de pie' };
          if (valid(item)) { suggestions.push(item); found = true; break; }
        }
      if (found || scanned >= 240) break;
    }
  }
  return suggestions.length
    ? `Ubicaciones de luminarias ya comprobadas en este plano (catalogId, xMm, yMm, rotation): ${JSON.stringify(suggestions.map(({ catalogId, xMm, yMm, rotation }) => ({ catalogId, xMm, yMm, rotation })))}. Si propones iluminación, prioriza una de ellas; son posiciones de objetos editables, no luces inventadas.`
    : 'No hay ubicación de lámpara decorativa validada en este ámbito. No prometas iluminación nueva en el resumen.';
}
