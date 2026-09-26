import type { EditorDocument, Point, Stair } from './schema';
import { buildingDocuments } from './building-levels';
import { stairArrival } from './stair-arrival';
import { stairLayout } from './stair-layout';
import { localToWorld } from './spatial-properties';
import { walkthroughNavigation } from './walkthrough-navigation';

export interface BuildingStairLink {
  lowerLevelId: string;
  upperLevelId: string;
  stairId: string;
  widthMm: number;
  arrival: Point;
  direction: Point;
  outline: Point[];
}

/** Solo enlaza plantas contiguas si la escalera llega a la cota del suelo superior y tiene salida libre. */
export function buildingStairLinks(doc: EditorDocument): BuildingStairLink[] {
  const levels = buildingDocuments(doc);
  return levels.slice(0, -1).flatMap((lower, index) => {
    const upper = levels[index + 1]!;
    const nav = walkthroughNavigation(upper.document);
    return (lower.document.stairs ?? []).flatMap((stair: Stair) => {
      if (stair.heightMm / stair.stepCount > 220 || stair.widthMm <= 300) return [];
      const arrival = stairArrival(stair);
      if (Math.abs(lower.elevationMm + arrival.elevationMm - upper.elevationMm) > 10) return [];
      const threshold = { x: arrival.point.x + arrival.direction.x * 30,
        y: arrival.point.y + arrival.direction.y * 30 };
      const exit = { x: arrival.point.x + arrival.direction.x * 300,
        y: arrival.point.y + arrival.direction.y * 300 };
      const room = nav.roomAt(exit);
      if (!room || Math.abs(nav.floorAt(threshold)) > 10 || !nav.segmentFree(threshold, exit) || !nav.segmentFree(exit, {
        x: exit.x + arrival.direction.x * 100, y: exit.y + arrival.direction.y * 100,
      })) return [];
      return [{ lowerLevelId: lower.id, upperLevelId: upper.id, stairId: stair.id,
        widthMm: arrival.widthMm,
        arrival: arrival.point, direction: arrival.direction,
        outline: stairLayout(stair).outline.map((point) => localToWorld(stair, point)) }];
    });
  });
}
