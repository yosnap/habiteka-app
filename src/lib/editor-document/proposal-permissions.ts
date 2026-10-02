import type { FurnitureCatalogEntry } from './furniture-catalog';
import { getFurnitureCatalogEntry } from './furniture-catalog';
import type { NativeDesignFurniture } from './native-design-proposal';
import type { RenderDesignOptions } from './render-design-options';
import { localToWorld } from './spatial-properties';
import type { Point } from './schema';

export function proposalCategory(item: FurnitureCatalogEntry): RenderDesignOptions['additions'][number] | null {
  if (item.id === 'habiteka:outdoor:tira-led') return 'lights';
  if (item.id === 'habiteka:outdoor:puf-exterior') return 'furniture';
  if (item.profile === 'plant') return 'plants';
  // Plantas, macetas y jardineras de exterior son vegetación; el resto del perfil «outdoor» (carpas, pérgolas) es construcción.
  if (item.profile === 'outdoor' && /planta|maceta|jardinera/.test(item.id)) return 'plants';
  if (item.profile === 'lamp') return 'lights';
  if (item.kind.includes('espejo')) return 'mirrors';
  if (['rug', 'curtain', 'decor'].includes(item.profile)) return 'decor';
  if (['sofa', 'bed', 'chair', 'table', 'cabinet', 'shelf', 'bench'].includes(item.profile)) return 'furniture';
  return null; // No instalaciones, electrodomésticos ni construcción implícita.
}

export function allowedProposalCatalog(item: FurnitureCatalogEntry, options: RenderDesignOptions) {
  const category = proposalCategory(item);
  return options.freedom !== 'strict' && category !== null
    && (options.freedom === 'free' || options.additions.includes(category));
}

export function allowedProposalFurniture(item: NativeDesignFurniture, options: RenderDesignOptions, zonePolygon?: Point[]) {
  const catalog = getFurnitureCatalogEntry(item.catalogId);
  if (!catalog || !allowedProposalCatalog(catalog, options)) return false;
  const transform = { x: item.xMm, y: item.yMm, rotation: item.rotation, widthMm: catalog.widthMm, depthMm: catalog.depthMm };
  const footprint = [[0, 0], [catalog.widthMm, 0], [catalog.widthMm, catalog.depthMm], [0, catalog.depthMm]]
    .map(([x, y]) => localToWorld(transform, { x: x!, y: y! }));
  if (zonePolygon && !polygonContainsFootprint(zonePolygon, footprint)) return false;
  if (options.placement === 'all') return true;
  return options.regions.some(({ polygon }) => polygonContainsFootprint(polygon, footprint));
}

// Check complete edges, including concave notches between otherwise valid corners.
export function polygonContainsFootprint(polygon: Point[], footprint: Point[]) {
  if (!footprint.every(p => inside(polygon, p))) return false;
  for (let i = 0; i < footprint.length; i++) {
    const a = footprint[i]!, b = footprint[(i + 1) % footprint.length]!;
    const cuts = [0, 1];
    for (let j = 0; j < polygon.length; j++) {
      const c = polygon[j]!, d = polygon[(j + 1) % polygon.length]!;
      const rx = b.x - a.x, ry = b.y - a.y, sx = d.x - c.x, sy = d.y - c.y;
      const den = rx * sy - ry * sx;
      if (Math.abs(den) < 1e-9) continue;
      const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / den;
      const u = ((c.x - a.x) * ry - (c.y - a.y) * rx) / den;
      if (t > 0 && t < 1 && u >= 0 && u <= 1) cuts.push(t);
    }
    cuts.sort((x, y) => x - y);
    for (let k = 1; k < cuts.length; k++) {
      const t = (cuts[k - 1]! + cuts[k]!) / 2;
      if (!inside(polygon, { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })) return false;
    }
  }
  return true;
}

function inside(polygon: Point[], p: Point) {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[j]!, b = polygon[i]!;
    const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    if (Math.abs(cross) < 1e-6 && p.x >= Math.min(a.x, b.x) && p.x <= Math.max(a.x, b.x)
      && p.y >= Math.min(a.y, b.y) && p.y <= Math.max(a.y, b.y)) return true;
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) result = !result;
  }
  return result;
}
