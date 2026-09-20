import type { EditorDocument, Point, Wall } from './schema';
import { wallPoints } from './geometry';
import { splitWall } from './wall-commands';
import { mergeVertexInto } from './vertex-merge';

/** Proyección de `p` sobre el segmento a-b: parámetro t, distancia perpendicular y longitud del segmento. */
export function projectOnSegment(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x, dy = b.y - a.y, length2 = dx * dx + dy * dy;
  const t = length2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / length2 : 0;
  return { t, distance: Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t)), length: Math.sqrt(length2), point: { x: a.x + dx * t, y: a.y + dy * t } };
}

export interface WallSupport { wall: Wall; t: number; point: Point }

/**
 * Muro recto sobre cuyo cuerpo cae el punto (a menos de medio espesor más una holgura), lejos de sus extremos.
 * Es la situación típica de un tabique trazado hasta la cara de una fachada: toca el muro pero no comparte vértice.
 */
export function wallSupportAt(doc: EditorDocument, point: Point, options: { exclude?: Set<string>; endClearanceMm?: number; slackMm?: number } = {}): WallSupport | undefined {
  const { exclude, endClearanceMm = 150, slackMm = 50 } = options;
  return doc.walls.filter((wall) => !wall.hidden && !wall.curveHeightMm && !exclude?.has(wall.id))
    .map((wall) => { const [a, b] = wallPoints(doc, wall); return { wall, ...projectOnSegment(point, a, b) }; })
    .filter((c) => c.distance <= c.wall.thicknessMm / 2 + slackMm && c.t * c.length > endClearanceMm && (1 - c.t) * c.length > endClearanceMm)
    .sort((a, b) => a.distance - b.distance)[0];
}

/** Divide el muro de apoyo en el punto proyectado y devuelve el vértice nuevo, ya sobre el eje del muro. */
export function joinPointToWall(doc: EditorDocument, support: WallSupport): string {
  const vertexId = crypto.randomUUID();
  splitWall(doc, support.wall.id, support.t, vertexId, crypto.randomUUID());
  return vertexId;
}

const DANGLING_CORNER_MM = 100;

/**
 * Une los extremos sueltos de muros visibles a la construcción: un extremo que solo pertenece a un muro y queda a un
 * palmo de una esquina existente se fusiona con ella; si apoya en el cuerpo de otro muro, lo divide y comparte vértice.
 * Así una estancia trazada hasta la cara de una fachada queda cerrada sin arrastrar nada a mano.
 */
export function joinDanglingWallEnds(source: EditorDocument): EditorDocument {
  let doc = source, changed = false;
  const visible = (d: EditorDocument) => d.walls.filter((wall) => !wall.hidden);
  for (const vertexId of source.vertices.map((v) => v.id)) {
    const vertex = doc.vertices.find((v) => v.id === vertexId);
    if (!vertex) continue;
    const incident = visible(doc).filter((wall) => wall.startVertexId === vertexId || wall.endVertexId === vertexId);
    if (incident.length !== 1) continue;
    const own = new Set(incident.map((wall) => wall.id));
    const corner = doc.vertices.filter((v) => v.id !== vertexId && visible(doc).some((wall) => !own.has(wall.id) && (wall.startVertexId === v.id || wall.endVertexId === v.id)))
      .map((v) => ({ v, distance: Math.hypot(v.x - vertex.x, v.y - vertex.y) }))
      .filter((c) => c.distance <= DANGLING_CORNER_MM).sort((a, b) => a.distance - b.distance)[0];
    if (corner) { doc = mergeVertexInto(doc, vertexId, corner.v.id); changed = true; continue; }
    const support = wallSupportAt(doc, vertex, { exclude: own });
    if (!support) continue;
    if (doc === source) doc = structuredClone(source);
    doc = mergeVertexInto(doc, vertexId, joinPointToWall(doc, support)); changed = true;
  }
  return changed ? doc : source;
}
