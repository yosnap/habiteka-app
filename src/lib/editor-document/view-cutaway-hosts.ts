import type { EditorDocument } from './schema';
import { isWindowDressing } from './furniture-profiles';
import { objectCenter } from './spatial-properties';
import { wallPath } from './wall-path';

/** Asociación solo visual: huecos y cortinas cercanas se ocultan con su muro, sin editar el documento. */
export function viewCutawayHosts(doc: EditorDocument): Map<string, string> {
  const hosts = new Map(doc.openings.map(opening => [opening.id, opening.wallId]));
  const paths = doc.walls.filter(wall => !wall.hidden).map(wall => ({ wall, path: wallPath(doc, wall) }));
  for (const item of doc.furniture.filter(isWindowDressing)) {
    const center = objectCenter(item), angle = item.rotation * Math.PI / 180;
    const candidates = paths.flatMap(({ wall, path }) => {
      const t = path.project(center), nearest = path.at(t), tangent = path.tangent(t);
      const alignment = Math.abs(Math.cos(angle) * tangent.x + Math.sin(angle) * tangent.y);
      if (alignment < .9) return [];
      const distance = Math.hypot(center.x - nearest.x, center.y - nearest.y);
      const normalDepth = item.widthMm * Math.sqrt(Math.max(0, 1 - alignment ** 2)) + item.depthMm * alignment;
      return distance <= wall.thicknessMm / 2 + normalDepth / 2 + 250 ? [{ id: wall.id, distance }] : [];
    }).sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id));
    if (candidates[0]) hosts.set(item.id, candidates[0].id);
  }
  return hosts;
}
