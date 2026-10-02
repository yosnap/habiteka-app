import type { EditorDocument, Point } from '@/lib/editor-document/schema';
import { openingConstruction } from '@/lib/editor-document/construction-properties';
import { openingMeshes } from './scene/opening-meshes';
import type { SceneBox } from './scene/types';

export interface DoorSweepSolid {
  gate?: boolean;
  id: string;
  polygon: Point[];
  bottom: number;
  top: number;
}

function leafSolid(box: SceneBox, id: string, bottom: number, top: number): DoorSweepSolid {
  const center = { x: box.position[0] * 1000, y: box.position[2] * 1000 };
  const angle = -box.rotation, along = { x: Math.cos(angle), y: Math.sin(angle) };
  const across = { x: -along.y, y: along.x };
  const halfWidth = box.size[0] * 500, halfDepth = box.size[2] * 500;
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const;
  return { id, bottom, top, polygon: corners.map(([side, edge]) => ({
      x: center.x + side * along.x * halfWidth + edge * across.x * halfDepth,
      y: center.y + side * along.y * halfWidth + edge * across.y * halfDepth,
    })) };
}

/** El giro completo de la hoja, con la misma bisagra y anchura que el modelo 3D. */
export function doorSweepSolids(doc: EditorDocument): DoorSweepSolid[] {
  return doc.openings.filter((opening) => opening.kind === 'puerta').flatMap((opening) => {
    const props = openingConstruction(opening);
    const closed = openingMeshes(doc, { ...opening, openAngleDeg: 0 }).find((box) => box.role === 'leaf');
    if (!closed) return [];
    const closedSolid = leafSolid(closed, opening.id, props.elevationMm, props.elevationMm + props.heightMm);
    if (props.openAngleDeg <= 0) return [closedSolid];
    const leafWidth = closed.size[0] * 1000;
    const angle = -closed.rotation;
    const hinge = {
      x: closed.position[0] * 1000 - Math.cos(angle) * leafWidth / 2,
      y: closed.position[2] * 1000 - Math.sin(angle) * leafWidth / 2,
    };
    const radius = leafWidth + closed.size[2] * 500;
    const direction = (props.swing === 'left' ? 1 : -1) * (props.hinge === 'left' ? 1 : -1);
    const steps = Math.ceil(props.openAngleDeg / 5);
    const tip = (step: number): Point => {
      const theta = angle + direction * props.openAngleDeg * Math.PI / 180 * step / steps;
      return { x: hinge.x + Math.cos(theta) * radius, y: hinge.y + Math.sin(theta) * radius };
    };
    const sweep = Array.from({ length: steps }, (_, index) => ({
      id: opening.id,
      polygon: [hinge, tip(index), tip(index + 1)],
      bottom: props.elevationMm,
      top: props.elevationMm + props.heightMm,
    }));
    const opened = openingMeshes(doc, opening).find((box) => box.role === 'leaf');
    return [...sweep, closedSolid,
      ...(opened ? [leafSolid(opened, opening.id, props.elevationMm, props.elevationMm + props.heightMm)] : [])];
  });
}
