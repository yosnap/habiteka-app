import { magneticReferences } from './magnetic-alignment';
import type { EditorDocument, Point } from '@/lib/editor-document/schema';
import { assertEditorDocument } from '@/lib/editor-document/validation';
import { assertOpeningClearance } from '@/lib/editor-document/opening-clearance';
import { assertSpatialPlacement } from './spatial-placement';
import { constrainExteriorVertex } from '@/lib/editor-document/exterior-vertex-constraint';
import { wallPoints } from '@/lib/editor-document/geometry';

export interface VertexPreview {
  document: EditorDocument; point: Point; guides: { from: Point; to: Point }[]; error: string | null;
}
/** A candidate only: never writes history or moves neighboring vertex IDs. */
export function previewVertex(doc: EditorDocument, id: string, pointer: Point, scale: number, snap: boolean): VertexPreview {
  const vertex = doc.vertices.find((v) => v.id === id);
  if (!vertex) throw new Error('Vértice inexistente');
  const tolerance = 10 / Math.max(scale, .001), others = [...doc.vertices.filter((v) => v.id !== id), ...magneticReferences(doc, doc.walls.filter((w) => w.startVertexId === id || w.endVertexId === id).map((w) => w.id))];
  const closest = (axis: 'x' | 'y') => others.filter((v) => Math.abs(v[axis] - pointer[axis]) < tolerance)
    .sort((a, b) => Math.abs(a[axis] - pointer[axis]) - Math.abs(b[axis] - pointer[axis]))[0];
  const x = closest('x'), y = closest('y');
  let point = { x: snap && x ? x.x : pointer.x, y: snap && y ? y.y : pointer.y };
  const axes = doc.walls.filter((w) => w.startVertexId === id || w.endVertexId === id).flatMap((w) => {
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
  const candidate = { ...doc, vertices: doc.vertices.map((v) => v.id === id ? { ...v, ...point } : v) };
  const guides: { from: Point; to: Point }[] = [x && { from: x, to: point }, y && { from: y, to: point }].filter((g) => !!g);
  if (axis) guides.push({ from: axis.origin, to: point });
  let error: string | null = null;
  try {
    assertEditorDocument(candidate);
    const changed = candidate.walls.filter((w) => w.startVertexId === id || w.endVertexId === id);
    candidate.openings.filter((o) => changed.some((w) => w.id === o.wallId)).forEach((o) => assertOpeningClearance(candidate, o));
    assertSpatialPlacement(doc, candidate);
  } catch (cause) { error = cause instanceof Error ? cause.message : 'Geometría inválida'; }
  return { document: candidate, point, guides, error };
}
