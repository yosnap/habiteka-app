import type { EditorDocument, Point } from '@/lib/editor-document/schema';
import { openingConstruction } from '@/lib/editor-document/construction-properties';
import { leafEnds, worldOpeningLeaves, type WorldLeaf } from '@/lib/editor-document/opening-leaves';

export interface DoorSweepSolid {
  gate?: boolean;
  id: string;
  polygon: Point[];
  bottom: number;
  top: number;
}

function leafSolid(leaf: WorldLeaf, id: string, bottom: number, top: number): DoorSweepSolid {
  const [from, to] = leafEnds(leaf), half = leaf.thicknessMm / 2;
  const across = { x: -Math.sin(leaf.angle) * half, y: Math.cos(leaf.angle) * half };
  return { id, bottom, top, polygon: [
    { x: from.x - across.x, y: from.y - across.y }, { x: to.x - across.x, y: to.y - across.y },
    { x: to.x + across.x, y: to.y + across.y }, { x: from.x + across.x, y: from.y + across.y },
  ] };
}

/** Las guías y los paneles recogidos de una seccional ocupan una franja bajo el techo, por encima del hueco. */
const OVERHEAD_BELOW_MM = 20, OVERHEAD_ABOVE_MM = 350;

/**
 * Lo que cada puerta necesita libre, con la misma luz y bisagra que el modelo 3D: el abanico de cada hoja abatible
 * (en una pivotante, también el del tramo al otro lado del eje; en una de vaivén, hacia las dos caras), la franja por
 * la que se desliza una corredera vista o se pliega un acordeón, y la hoja cerrada y abierta. Una corredera empotrada o
 * en marco no sale del muro: solo cuenta su hoja. Con la puerta cerrada (0°) basta la hoja, más las guías de una
 * seccional, que van siempre bajo el techo y no estorban a lo que quede por debajo.
 */
export function doorSweepSolids(doc: EditorDocument): DoorSweepSolid[] {
  return doc.openings.filter((opening) => opening.kind === 'puerta').flatMap((opening) => {
    const props = openingConstruction(opening), bottom = props.elevationMm, top = props.elevationMm + props.heightMm;
    const closed = worldOpeningLeaves(doc, { ...opening, openAngleDeg: 0 });
    if (!closed) return [];
    const closedSolids = [...closed.leaves.map((leaf) => leafSolid(leaf, opening.id, bottom, top)),
      ...(closed.overhead ? [{ id: opening.id, polygon: closed.overhead, bottom: top - OVERHEAD_BELOW_MM, top: top + OVERHEAD_ABOVE_MM }] : [])];
    if (props.openAngleDeg <= 0) return closedSolids;
    const opened = worldOpeningLeaves(doc, opening)!;
    const steps = Math.ceil(props.openAngleDeg / 5);
    const sweep = closed.leaves.flatMap((leaf, index) => {
      const turn = opened.leaves[index]?.hinge?.delta;
      if (!leaf.hinge || turn === undefined) return [];
      const { pivot, closedAngle, offsetMm = 0, doubleActing } = leaf.hinge, half = leaf.thicknessMm / 2;
      const fan = (radius: number, start: number, delta: number) => {
        const tip = (step: number): Point => {
          const theta = start + delta * step / steps;
          return { x: pivot.x + Math.cos(theta) * radius, y: pivot.y + Math.sin(theta) * radius };
        };
        return Array.from({ length: steps }, (_, step) => ({ id: opening.id, polygon: [pivot, tip(step), tip(step + 1)], bottom, top }));
      };
      return [...fan(leaf.lengthMm - offsetMm + half, closedAngle, turn),
        ...(offsetMm ? fan(offsetMm + half, closedAngle + Math.PI, turn) : []),
        ...(doubleActing ? fan(leaf.lengthMm - offsetMm + half, closedAngle, -turn) : [])];
    });
    const travel = opened.travel.map((polygon) => ({ id: opening.id, polygon, bottom, top }));
    return [...sweep, ...travel, ...closedSolids, ...opened.leaves.map((leaf) => leafSolid(leaf, opening.id, bottom, top))];
  });
}
