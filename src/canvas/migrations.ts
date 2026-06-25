/**
 * Migración de CanvasDoc v1 → v2.
 *
 * v1: muros almacenados como StructObj {kind:'wall', x,y,width,height,rotation}.
 * v2: muros como WallSegment[] en CanvasDoc.walls; StructObj solo contiene muebles,
 *     puertas y ventanas.
 *
 * Esta función es PURA (sin efectos secundarios) para que sea testeable y se pueda
 * aplicar tanto en el script SQL de migración de BD como al importar docs JSON legacy.
 */
import type { CanvasDoc, StructObj, WallSegment, Point2D } from './types';

const PARENT_SEARCH_RADIUS_PX = 150;

/**
 * Migra un doc de cualquier versión al modelo v2.
 * Idempotente: llamar varias veces sobre el mismo doc produce el mismo resultado.
 */
export function migrateDoc(doc: CanvasDoc): CanvasDoc {
  const version = doc.version ?? 1;
  if (version >= 2) return doc;

  const wallObjects = doc.objects.filter((o) => o.kind === 'wall');
  const nonWallObjects = doc.objects.filter((o) => o.kind !== 'wall');

  const walls: WallSegment[] = wallObjects.map(wallRectToSegment);

  // Assign catalogId (builtin slug) and parentId (for doors/windows)
  const migratedObjects: StructObj[] = nonWallObjects.map((obj) => {
    const withCatalogId: StructObj = {
      ...obj,
      catalogId: obj.catalogId ?? `builtin:${obj.kind}`,
    };

    if (obj.kind !== 'door' && obj.kind !== 'window') return withCatalogId;

    const nearest = findNearestWall(obj, walls);
    if (!nearest) return withCatalogId;

    return { ...withCatalogId, parentId: obj.parentId ?? nearest.id };
  });

  return {
    ...doc,
    version: 2,
    walls: [...(doc.walls ?? []), ...walls],
    objects: migratedObjects,
  };
}

/**
 * Convierte un rectángulo de muro (v1) a WallSegment (v2).
 *
 * Konva rota los objetos alrededor de la esquina superior-izquierda (x,y).
 * Los endpoints del segmento son los centros de los dos extremos cortos:
 *
 *   local coords: p1 = (0, height/2),  p2 = (width, height/2)
 *   world coords: rotated around (x, y) by `rotation` degrees (clockwise, Y-down)
 *
 *   x' = x + lx*cos(rad) - ly*sin(rad)
 *   y' = y + lx*sin(rad) + ly*cos(rad)
 */
function wallRectToSegment(rect: StructObj): WallSegment {
  const rad = ((rect.rotation ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const hh = rect.height / 2; // half-thickness (local y of centerline)

  const p1: Point2D = {
    x: rect.x - hh * sin,
    y: rect.y + hh * cos,
  };
  const p2: Point2D = {
    x: rect.x + rect.width * cos - hh * sin,
    y: rect.y + rect.width * sin + hh * cos,
  };

  return {
    id: rect.id,
    p1,
    p2,
    thicknessPx: rect.height,
    ...(rect.heightM !== undefined && { heightM: rect.heightM }),
    ...(rect.color !== undefined && { color: rect.color }),
    ...(rect.meta !== undefined && { meta: rect.meta }),
  };
}

/**
 * Punto más cercano de un segmento a un punto P, usando proyección escalar.
 * Devuelve la distancia euclídea mínima.
 */
function distPointToSegment(p: Point2D, a: Point2D, b: Point2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * Encuentra el WallSegment más cercano al centro geométrico del objeto.
 * Si ninguno está a < PARENT_SEARCH_RADIUS_PX, devuelve null (fallback seguro).
 */
function findNearestWall(obj: StructObj, walls: WallSegment[]): WallSegment | null {
  const cx = obj.x + obj.width / 2;
  const cy = obj.y + obj.height / 2;
  const center: Point2D = { x: cx, y: cy };

  let nearest: WallSegment | null = null;
  let nearestDist = PARENT_SEARCH_RADIUS_PX;

  for (const wall of walls) {
    const dist = distPointToSegment(center, wall.p1, wall.p2);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = wall;
    }
  }

  return nearest;
}
