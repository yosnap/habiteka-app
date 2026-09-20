import type { EditorDocument } from './schema';
import type { KitchenRun } from './kitchen-run-types';
import type { KitchenRunExtraCuts, Span } from './kitchen-run-volumes';
import { localToWorld, projectAlong, worldToLocal } from './spatial-properties';
import { wallPath } from './wall-path';

const EPS = 1, FACE_TOLERANCE = 60;
/**
 * Lo que el entorno recorta del mueble: un pilar que cae sobre el tramo vacía zócalo, bajos y altos en su huella y la
 * encimera continúa por delante si el pilar no ocupa todo el fondo; los altos se omiten donde el muro de apoyo tiene ventana.
 */
export function kitchenRunObstacles(doc: EditorDocument, run: KitchenRun): KitchenRunExtraCuts {
  const cuts: KitchenRunExtraCuts = { plinth: [], base: [], worktop: [], uppers: [], worktopNotches: [] };
  const w = run.widthMm, d = run.depthMm, u = run.kitchen.uppers, floor = run.elevationMm;
  for (const column of doc.columns ?? []) {
    const top = column.elevationMm + column.heightMm;
    if (top <= floor + EPS || column.elevationMm >= floor + run.heightMm - EPS) continue;
    const corners = [{ x: 0, y: 0 }, { x: column.widthMm, y: 0 }, { x: column.widthMm, y: column.depthMm }, { x: 0, y: column.depthMm }]
      .map((p) => worldToLocal(run, localToWorld(column, p)));
    const minX = Math.min(...corners.map((c) => c.x)), maxX = Math.max(...corners.map((c) => c.x));
    const minY = Math.min(...corners.map((c) => c.y)), maxY = Math.max(...corners.map((c) => c.y));
    if (maxX <= EPS || minX >= w - EPS || maxY <= EPS || minY >= d - EPS) continue;
    const span: Span = { from: Math.max(0, minX), to: Math.min(w, maxX) };
    cuts.plinth.push(span); cuts.base.push(span);
    if (u && minY < u.depthMm && top > floor + u.bottomMm) cuts.uppers.push(span);
    if (minY <= EPS && maxY < d - EPS) cuts.worktopNotches.push({ ...span, depthMm: maxY }); else cuts.worktop.push(span);
  }
  if (u) {
    const back = [localToWorld(run, { x: 0, y: 0 }), localToWorld(run, { x: w, y: 0 })];
    const a = run.rotation * Math.PI / 180, along = { x: Math.cos(a), y: Math.sin(a) };
    for (const wall of doc.walls) {
      if (wall.hidden || wall.curveHeightMm) continue;
      const path = wallPath(doc, wall), start = path.at(0), t = path.tangent(0), n = { x: -t.y, y: t.x };
      if (Math.abs(t.x * along.x + t.y * along.y) < Math.cos(Math.PI / 36)) continue;
      // La trasera del tramo debe descansar en una cara de este muro.
      const gaps = back.map((p) => Math.abs(Math.abs((p.x - start.x) * n.x + (p.y - start.y) * n.y) - wall.thicknessMm / 2));
      if (Math.max(...gaps) > FACE_TOLERANCE) continue;
      const covered = back.map((p) => (p.x - start.x) * t.x + (p.y - start.y) * t.y);
      if (Math.max(...covered) < 0 || Math.min(...covered) > path.length) continue;
      for (const opening of doc.openings.filter((o) => o.wallId === wall.id && o.kind === 'ventana')) {
        const bottom = opening.elevationMm ?? 900, topMm = bottom + (opening.heightMm ?? 1200);
        if (topMm <= floor + u.bottomMm || bottom >= floor + u.bottomMm + u.heightMm) continue;
        const centre = projectAlong(run, path.at(opening.position));
        const span = { from: Math.max(0, centre - opening.widthMm / 2), to: Math.min(w, centre + opening.widthMm / 2) };
        if (span.to - span.from > EPS) cuts.uppers.push(span);
      }
    }
  }
  return cuts;
}
