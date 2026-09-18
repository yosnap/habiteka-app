import type { EditorDocument, Point } from './schema';
import { EPSILON, wallPoints } from './geometry';

/**
 * Los límites importados representan la parcela, no una pared física oculta.
 * Su unión con la casa puede deslizarse por el perímetro; una esquina queda fija.
 * El prefijo es el identificador persistido por fromPlanImport, también en planos existentes.
 */
export function constrainExteriorVertex(doc: EditorDocument, id: string, target: Point): Point {
  const boundaries = doc.walls.filter((wall) => wall.hidden && wall.id.startsWith('hidden:') &&
    (wall.startVertexId === id || wall.endVertexId === id));
  if (!boundaries.length) return target;
  const vertex = doc.vertices.find((item) => item.id === id)!;
  const directions = boundaries.map((wall) => {
    const [a, b] = wallPoints(doc, wall);
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    return { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
  });
  const direction = directions[0]!;
  if (directions.some((other) => Math.abs(direction.x * other.y - direction.y * other.x) > EPSILON)) {
    return { x: vertex.x, y: vertex.y };
  }
  const along = (target.x - vertex.x) * direction.x + (target.y - vertex.y) * direction.y;
  return { x: vertex.x + along * direction.x, y: vertex.y + along * direction.y };
}
