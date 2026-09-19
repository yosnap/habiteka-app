import { planObjects } from '@/lib/editor-document/boundary-types';
import type { EditorDocument, Point } from '@/lib/editor-document/schema';
import { upgradeSpatialDocument } from '@/lib/editor-document/spatial-properties';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { constrainExteriorVertex } from '@/lib/editor-document/exterior-vertex-constraint';
import { wallPath } from '@/lib/editor-document/wall-path';
import { assertOpeningClearance } from '@/lib/editor-document/opening-clearance';
import { assertEditorDocument } from '@/lib/editor-document/validation';
import { reconcileCeilings } from '@/lib/editor-document/ceiling-reconciliation';
import { insideRoom, luminairePlacementIssue } from '@/lib/editor-document/ceiling-geometry';
import { syncRampArrival } from '@/lib/editor-document/construction-commands';

/** Traslación única: vértices compartidos y elementos seleccionados nunca se desplazan dos veces. */
export function nudgeElements(source: EditorDocument, ids: string[], delta: Point): EditorDocument {
  let doc = upgradeSpatialDocument(source);
  const selected = new Set(ids), vertices = new Set<string>();
  const rooms = deriveRooms(source).filter((r) => selected.has(r.id) || source.ceilings?.some((c) => selected.has(c.id) && c.roomId === r.id));
  for (const wall of source.walls) if (selected.has(wall.id)) { vertices.add(wall.startVertexId); vertices.add(wall.endVertexId); }
  for (const room of rooms) for (const id of room.vertexIds) {
    const patio = room.wallIds.some((w) => w.startsWith('outdoor:'));
    if (patio && source.walls.some((w) => (!w.id.startsWith('outdoor:') || !room.wallIds.includes(w.id)) && (w.startVertexId === id || w.endVertexId === id))) continue;
    vertices.add(id);
  }
  for (const v of doc.vertices) if (vertices.has(v.id) || selected.has(v.id))
    Object.assign(v, constrainExteriorVertex(source, v.id, { x: v.x + delta.x, y: v.y + delta.y }));
  for (const item of [...planObjects(doc), ...(doc.stairs ?? []), ...(doc.ramps ?? []), ...(doc.columns ?? []), ...(doc.luminaires ?? []), ...doc.labels])
    if (selected.has(item.id)) { item.x += delta.x; item.y += delta.y; }
  for (const boundary of doc.boundaries ?? []) if (!selected.has(boundary.id)) {
    const angle = boundary.rotation * Math.PI / 180;
    for (const gate of boundary.construction.gates) if (selected.has(gate.id))
      gate.positionMm += delta.x * Math.cos(angle) + delta.y * Math.sin(angle);
  }
  for (const dim of doc.dimensions) if (selected.has(dim.id)) {
    dim.from = { x: dim.from.x + delta.x, y: dim.from.y + delta.y }; dim.to = { x: dim.to.x + delta.x, y: dim.to.y + delta.y };
  }
  for (const room of rooms) {
    const shifts = room.vertexIds.map((id) => { const before = source.vertices.find((v) => v.id === id)!, after = doc.vertices.find((v) => v.id === id)!; return { x: after.x - before.x, y: after.y - before.y }; });
    for (const label of doc.labels) if (!selected.has(label.id) && insideRoom(label, room.boundary)) {
      label.x += shifts.reduce((sum, d) => sum + d.x, 0) / shifts.length; label.y += shifts.reduce((sum, d) => sum + d.y, 0) / shifts.length;
    }
  }
  for (const opening of doc.openings) if (selected.has(opening.id) && !selected.has(opening.wallId) && !doc.walls.some((w) => w.id === opening.wallId && vertices.has(w.startVertexId) && vertices.has(w.endVertexId))) {
    const wall = doc.walls.find((w) => w.id === opening.wallId)!, path = wallPath(doc, wall), direction = path.tangent(opening.position);
    opening.position += (delta.x * direction.x + delta.y * direction.y) / path.length;
  }
  for (const route of doc.walkthroughs ?? []) for (const point of route.waypoints)
    if (selected.has(point.id) || selected.has(route.id)) { point.x += delta.x; point.y += delta.y; }
  for (const light of doc.luminaires ?? []) if (selected.has(light.id)) {
    const issue = luminairePlacementIssue(doc, light); if (issue) throw new Error(issue);
  }
  doc = reconcileCeilings(source, doc);
  for (const ramp of doc.ramps ?? []) if (selected.has(ramp.id)) doc = syncRampArrival(doc, ramp.id);
  doc.revision++; assertEditorDocument(doc);
  for (const opening of doc.openings) if (selected.has(opening.id)) assertOpeningClearance(doc, opening);
  return doc;
}
