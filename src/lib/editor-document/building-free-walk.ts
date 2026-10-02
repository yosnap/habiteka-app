import type { EditorDocument, Point } from './schema';
import { buildingDocuments } from './building-levels';
import { buildingStairLinks } from './building-stair-links';
import { moveFreeWalk } from './free-walk-navigation';
import { CAMERA_CLEARANCE_MM, walkthroughNavigation } from './walkthrough-navigation';

export interface BuildingWalkPosition { levelId: string; point: Point }

export function buildingWalkNavigation(doc: EditorDocument) {
  const levels = buildingDocuments(doc), links = buildingStairLinks(doc);
  const navs = new Map(levels.map((level) => [level.id, walkthroughNavigation(level.document, undefined, {
    floor: links.filter((link) => link.upperLevelId === level.id).map((link) => link.outline),
    ceiling: links.filter((link) => link.lowerLevelId === level.id).map((link) => link.outline),
  })]));
  return { levels, links, navs };
}

/** Cruza el borde del último peldaño solo si ambos lados están libres y a la misma cota absoluta. */
export function moveBuildingWalk(context: ReturnType<typeof buildingWalkNavigation>, from: BuildingWalkPosition, delta: Point): BuildingWalkPosition {
  const nav = context.navs.get(from.levelId);
  if (!nav) return from;
  const point = moveFreeWalk(nav, from.point, delta);
  for (const link of context.links) {
    const up = link.lowerLevelId === from.levelId;
    if (!up && link.upperLevelId !== from.levelId) continue;
    const direction = up ? link.direction : { x: -link.direction.x, y: -link.direction.y };
    if (delta.x * direction.x + delta.y * direction.y <= 0) continue;
    const along = (point.x - link.arrival.x) * link.direction.x + (point.y - link.arrival.y) * link.direction.y;
    const across = Math.abs((point.x - link.arrival.x) * link.direction.y - (point.y - link.arrival.y) * link.direction.x);
    if (across > link.widthMm / 2 - CAMERA_CLEARANCE_MM || (up ? along < -80 || along > 10 : along < -10 || along > 80)) continue;
    const destination = { x: link.arrival.x + link.direction.x * (up ? 30 : -30),
      y: link.arrival.y + link.direction.y * (up ? 30 : -30) };
    const targetId = up ? link.upperLevelId : link.lowerLevelId;
    const target = context.navs.get(targetId);
    const level = context.levels.find((item) => item.id === from.levelId);
    const nextLevel = context.levels.find((item) => item.id === targetId);
    if (!target?.free(destination) || !level || !nextLevel) continue;
    if (Math.abs(level.elevationMm + nav.floorAt(point) - nextLevel.elevationMm - target.floorAt(destination)) > 30) continue;
    return { levelId: targetId, point: destination };
  }
  return { levelId: from.levelId, point };
}
