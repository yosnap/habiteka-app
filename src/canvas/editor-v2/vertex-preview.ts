import { magneticReferences } from './magnetic-alignment';
import type { EditorDocument, Point } from '@/lib/editor-document/schema';
import { assertEditorDocument } from '@/lib/editor-document/validation';
import { assertOpeningClearanceNotWorse } from '@/lib/editor-document/opening-clearance';
import { assertSpatialPlacement } from './spatial-placement';
import { constrainExteriorVertex } from '@/lib/editor-document/exterior-vertex-constraint';
import { wallPoints } from '@/lib/editor-document/geometry';
import { mergeVertexInto } from '@/lib/editor-document/vertex-merge';
import { joinPointToWall, wallSupportAt } from '@/lib/editor-document/wall-join';
import { snapRadiusMm } from './snap-radius';

export interface VertexPreview {
  document: EditorDocument; point: Point; guides: { from: Point; to: Point }[]; error: string | null;
}
/** A candidate only: never writes history or moves neighboring vertex IDs. */
export function previewVertex(doc: EditorDocument, id: string, pointer: Point, scale: number, snap: boolean): VertexPreview {
  const vertex = doc.vertices.find((v) => v.id === id);
  if (!vertex) throw new Error('Vértice inexistente');
  const tolerance = snapRadiusMm(scale, 10), incidentWalls = doc.walls.filter((w) => w.startVertexId === id || w.endVertexId === id);
  const incident = new Set(incidentWalls.map((w) => w.id));
  // Un vértice de un muro incidente no es destino: fusionarlo degeneraría ese muro.
  const neighbors = new Set(incidentWalls.flatMap((w) => [w.startVertexId, w.endVertexId]));
  // La esquina real más cercana gana en 2D antes que cualquier alineación por ejes: es lo que el usuario quiere unir.
  const corner = snap ? doc.vertices.filter((v) => v.id !== id && !neighbors.has(v.id))
    .map((v) => ({ v, gap: Math.hypot(v.x - pointer.x, v.y - pointer.y) })).filter((c) => c.gap <= snapRadiusMm(scale, 12))
    .sort((a, b) => a.gap - b.gap)[0]?.v : undefined;
  // Ejes y vértices de otros muros, nunca sus caras: una cara a medio grosor de la esquina crearía un vértice fantasma.
  const others = [...doc.vertices.filter((v) => v.id !== id), ...magneticReferences(doc, [...incident], { faces: false })];
  const closest = (axis: 'x' | 'y') => others.filter((v) => Math.abs(v[axis] - pointer[axis]) < tolerance)
    .sort((a, b) => Math.abs(a[axis] - pointer[axis]) - Math.abs(b[axis] - pointer[axis]))[0];
  const x = corner ? undefined : closest('x'), y = corner ? undefined : closest('y');
  let point = corner ? { x: corner.x, y: corner.y } : { x: snap && x ? x.x : pointer.x, y: snap && y ? y.y : pointer.y };
  const axes = corner ? [] : incidentWalls.flatMap((w) => {
    const [a, b] = wallPoints(doc, w), origin = w.startVertexId === id ? b : a;
    const length = Math.hypot(b.x - a.x, b.y - a.y), ux = (b.x - a.x) / length, uy = (b.y - a.y) / length;
    return [{ origin, dx: ux, dy: uy }, { origin, dx: -uy, dy: ux }].map(({ origin, dx, dy }) => {
      const along = (pointer.x - origin.x) * dx + (pointer.y - origin.y) * dy;
      const target = { x: origin.x + dx * along, y: origin.y + dy * along };
      return { origin, target, gap: Math.hypot(pointer.x - target.x, pointer.y - target.y) };
    });
  }).filter((g) => g.gap < tolerance).sort((a, b) => a.gap - b.gap);
  const axis = !x && !y ? axes[0] : undefined;
  if (snap && axis) point = axis.target;
  point = constrainExteriorVertex(doc, id, point);
  // Soltar exactamente sobre otro vértice lo fusiona: así un patio puede compartir esquinas y muros con la casa.
  const twin = snap ? doc.vertices.find((v) => v.id !== id && !neighbors.has(v.id) && Math.hypot(v.x - point.x, v.y - point.y) < .5) : undefined;
  // Soltarlo sobre el cuerpo de otro muro lo divide ahí y une ambos (unión en T): cierra estancias trazadas hasta la cara.
  const support = snap && !twin ? wallSupportAt(doc, point, { exclude: incident }) : undefined;
  if (support) point = support.point;
  const moved = structuredClone({ ...doc, vertices: doc.vertices.map((v) => v.id === id ? { ...v, ...point } : v) });
  const joined = support ? joinPointToWall(moved, wallSupportAt(moved, point, { exclude: incident })!) : undefined;
  const candidate = twin ? mergeVertexInto(moved, id, twin.id) : joined ? mergeVertexInto(moved, id, joined) : moved;
  const guides: { from: Point; to: Point }[] = [x && { from: x, to: point }, y && { from: y, to: point }].filter((g) => !!g);
  if (axis) guides.push({ from: axis.origin, to: point });
  let error: string | null = null;
  try {
    assertEditorDocument(candidate);
    const changed = candidate.walls.filter((w) => [w.startVertexId, w.endVertexId].some((v) => v === id || v === twin?.id || v === joined));
    candidate.openings.filter((o) => changed.some((w) => w.id === o.wallId)).forEach((o) => assertOpeningClearanceNotWorse(doc, candidate, o));
    assertSpatialPlacement(doc, candidate);
  } catch (cause) { error = cause instanceof Error ? cause.message : 'Geometría inválida'; }
  if (!error && twin) guides.push({ from: twin, to: point });
  if (!error && support) guides.push({ from: support.point, to: point });
  return { document: candidate, point, guides, error };
}
