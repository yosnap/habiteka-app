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
import { splitWall } from '@/lib/editor-document/wall-commands';
import { wallPath } from '@/lib/editor-document/wall-path';

export interface VertexPreview {
  document: EditorDocument; point: Point; guides: { from: Point; to: Point }[]; error: string | null;
}
/**
 * `free` (⌘ o Ctrl al arrastrar): el extremo no se une a esquinas ni a muros, aunque sigue las guías de alineación.
 * `detachWalls`: solo esos muros siguen al extremo; los demás conservan la esquina. Así se prolonga un muro más allá
 * de una esquina, y si pasa por ella, la esquina queda unida en T al muro prolongado.
 */
export interface VertexDragOptions { free?: boolean; detachWalls?: readonly string[] }

/** A candidate only: never writes history or moves neighboring vertex IDs. */
export function previewVertex(source: EditorDocument, sourceId: string, pointer: Point, scale: number, snap: boolean,
  options: VertexDragOptions = {}): VertexPreview {
  const { doc, id, corner: anchored } = detachVertex(source, sourceId, options.detachWalls);
  const free = !!options.free;
  const vertex = doc.vertices.find((v) => v.id === id);
  if (!vertex) throw new Error('Vértice inexistente');
  const tolerance = snapRadiusMm(scale, 10), incidentWalls = doc.walls.filter((w) => w.startVertexId === id || w.endVertexId === id);
  const incident = new Set(incidentWalls.map((w) => w.id));
  // Un vértice de un muro incidente no es destino: fusionarlo degeneraría ese muro.
  const neighbors = new Set(incidentWalls.flatMap((w) => [w.startVertexId, w.endVertexId]));
  // La esquina real más cercana gana en 2D antes que cualquier alineación por ejes: es lo que el usuario quiere unir.
  const corner = snap && !free ? doc.vertices.filter((v) => v.id !== id && !neighbors.has(v.id))
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
  // Al alargar deprisa, el extremo se pasa unos centímetros de la pared de destino: se recorta hasta ella.
  if (snap && !free && !corner) point = trimOvershoot(doc, id, incidentWalls, point, scale);
  point = constrainExteriorVertex(doc, id, point);
  // Soltar exactamente sobre otro vértice lo fusiona: así un patio puede compartir esquinas y muros con la casa.
  const twin = snap && !free ? doc.vertices.find((v) => v.id !== id && !neighbors.has(v.id) && Math.hypot(v.x - point.x, v.y - point.y) < .5) : undefined;
  // Soltarlo sobre el cuerpo de otro muro lo divide ahí y une ambos (unión en T): cierra estancias trazadas hasta la cara.
  const support = snap && !free && !twin ? wallSupportAt(doc, point, { exclude: incident }) : undefined;
  if (support) point = support.point;
  const moved = structuredClone({ ...doc, vertices: doc.vertices.map((v) => v.id === id ? { ...v, ...point } : v) });
  const joined = support ? joinPointToWall(moved, wallSupportAt(moved, point, { exclude: incident })!) : undefined;
  const merged = twin ? mergeVertexInto(moved, id, twin.id) : joined ? mergeVertexInto(moved, id, joined) : moved;
  // Las esquinas por las que pasa el muro alargado (incluida la que dejó con ⌘) quedan unidas en T.
  const candidate = joinPassThrough(merged, [...incident]);
  void anchored;
  const guides: { from: Point; to: Point }[] = [x && { from: x, to: point }, y && { from: y, to: point }].filter((g) => !!g);
  if (axis) guides.push({ from: axis.origin, to: point });
  let error: string | null = null;
  try {
    assertEditorDocument(candidate);
    const changed = candidate.walls.filter((w) => [w.startVertexId, w.endVertexId].some((v) => v === id || v === twin?.id || v === joined));
    candidate.openings.filter((o) => changed.some((w) => w.id === o.wallId)).forEach((o) => assertOpeningClearanceNotWorse(doc, candidate, o));
    assertSpatialPlacement(doc, candidate);
  } catch (cause) { error = friendlyError(cause instanceof Error ? cause.message : 'Geometría inválida'); }
  if (!error && twin) guides.push({ from: twin, to: point });
  if (!error && support) guides.push({ from: support.point, to: point });
  return { document: candidate, point, guides, error };
}

/**
 * Centro y ángulo de los muros seleccionados tal como quedarían. Se leen de la vista previa: al soltar sobre otro
 * vértice este se fusiona y el muro original apunta a un vértice que ya no existe.
 */
export function previewWallAngles(preview: VertexPreview, selected: readonly string[]): { id: string; at: Point; degrees: number; lengthMm: number }[] {
  return preview.document.walls.filter((w) => selected.includes(w.id)).map((w) => {
    const [a, b] = wallPoints(preview.document, w);
    return { id: w.id, at: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, degrees: Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI,
      lengthMm: Math.hypot(b.x - a.x, b.y - a.y) };
  });
}

/** Separa los muros indicados de la esquina con un vértice propio; el resto conserva el vértice original. */
function detachVertex(doc: EditorDocument, id: string, walls: readonly string[] | undefined): { doc: EditorDocument; id: string; corner?: string } {
  const incident = doc.walls.filter((w) => w.startVertexId === id || w.endVertexId === id);
  const moving = incident.filter((w) => walls?.includes(w.id));
  if (!moving.length || moving.length === incident.length) return { doc, id };
  const vertex = doc.vertices.find((v) => v.id === id)!, cloneId = crypto.randomUUID(), ids = new Set(moving.map((w) => w.id));
  return { id: cloneId, corner: id, doc: { ...doc, vertices: [...doc.vertices, { ...vertex, id: cloneId }],
    walls: doc.walls.map((w) => ids.has(w.id) ? { ...w, startVertexId: w.startVertexId === id ? cloneId : w.startVertexId,
      endVertexId: w.endVertexId === id ? cloneId : w.endVertexId } : w) } };
}

/** Une en T cada esquina existente por la que pasa un muro movido: se divide ahí y comparte el vértice. */
function joinPassThrough(doc: EditorDocument, wallIds: readonly string[]): EditorDocument {
  let next = doc;
  const moving = new Set(wallIds);
  for (let guard = 0; guard < 24; guard++) {
    const found = passThrough(next, moving);
    if (!found) return next;
    const copy = structuredClone(next), splitId = crypto.randomUUID(), newWallId = crypto.randomUUID();
    // Una abertura justo en esa esquina impide dividir: el muro se queda sin esa unión.
    try { splitWall(copy, found.wallId, found.t, splitId, newWallId); } catch { return next; }
    next = mergeVertexInto(copy, splitId, found.vertexId);
    moving.add(newWallId);
  }
  return next;
}

function passThrough(doc: EditorDocument, moving: ReadonlySet<string>): { wallId: string; vertexId: string; t: number } | null {
  const used = new Set(doc.walls.flatMap((w) => [w.startVertexId, w.endVertexId]));
  for (const wallId of moving) {
    const wall = doc.walls.find((w) => w.id === wallId);
    if (!wall) continue;
    const path = wallPath(doc, wall);
    for (const vertex of doc.vertices) {
      if (!used.has(vertex.id) || vertex.id === wall.startVertexId || vertex.id === wall.endVertexId) continue;
      const t = path.project(vertex);
      if (t <= 0.001 || t >= 0.999) continue;
      const at = path.at(t);
      if (Math.hypot(at.x - vertex.x, at.y - vertex.y) <= 1) return { wallId, vertexId: vertex.id, t };
    }
  }
  return null;
}

/**
 * Como «alargar hasta el límite» en CAD: si el único muro que se alarga cruza otro muro a poca distancia del extremo,
 * el extremo se queda en ese muro (o en su esquina, si está cerca) en lugar de atravesarlo.
 */
function trimOvershoot(doc: EditorDocument, id: string, incidentWalls: EditorDocument['walls'], point: Point, scale: number): Point {
  if (incidentWalls.length !== 1 || incidentWalls[0]!.curveHeightMm) return point;
  const wall = incidentWalls[0]!, [a, b] = wallPoints(doc, wall), fixed = wall.startVertexId === id ? b : a;
  const reach = snapRadiusMm(scale, 30), cornerReach = snapRadiusMm(scale, 12);
  let best: { point: Point; gap: number } | null = null;
  for (const other of doc.walls) {
    if (other.id === wall.id || other.curveHeightMm || other.startVertexId === id || other.endVertexId === id) continue;
    const [c, d] = wallPoints(doc, other), hit = crossing(fixed, point, c, d);
    if (!hit) continue;
    const gap = Math.hypot(point.x - hit.x, point.y - hit.y);
    if (gap > reach || (best && gap >= best.gap)) continue;
    const end = [c, d].find((p) => Math.hypot(p.x - hit.x, p.y - hit.y) <= cornerReach);
    best = { point: end ? { x: end.x, y: end.y } : hit, gap };
  }
  return best?.point ?? point;
}

/** Punto de cruce de dos segmentos (sin contar el arranque del primero), o null. */
function crossing(p: Point, q: Point, r: Point, s: Point): Point | null {
  const dx = q.x - p.x, dy = q.y - p.y, ex = s.x - r.x, ey = s.y - r.y, den = dx * ey - dy * ex;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((r.x - p.x) * ey - (r.y - p.y) * ex) / den, u = ((r.x - p.x) * dy - (r.y - p.y) * dx) / den;
  return t > 0.001 && t <= 1 && u >= -1e-6 && u <= 1 + 1e-6 ? { x: p.x + dx * t, y: p.y + dy * t } : null;
}

/** Mensajes de validación en términos de lo que hace el usuario al arrastrar. */
function friendlyError(message: string): string {
  if (message === 'Intersección de muros sin vértice compartido') return 'Así cruzaría otra pared: suelta el extremo sobre una esquina o sobre la pared';
  if (message === 'Muros colineales superpuestos') return 'Así se montaría sobre otra pared: suéltalo antes o en su esquina';
  return message;
}
