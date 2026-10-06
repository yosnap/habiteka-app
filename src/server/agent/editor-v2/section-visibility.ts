import type { EditorDocument, Point } from '@/lib/editor-document/schema';
import { deriveRoomsSafe } from '@/lib/editor-document/rooms';
import { editorDocumentToScene } from '@/canvas/editor-v2/scene/editor-document-to-scene';
import { wallPath } from '@/lib/editor-document/wall-path';

export type SectionSide = 'front' | 'back' | 'left' | 'right';
export const SECTION_AXES: Record<SectionSide, { h: (x: number, y: number) => number; depth: (x: number, y: number) => number; toward: [number, number] }> = {
  front: { h: x => x, depth: (_x, y) => -y, toward: [0, 1] },
  back: { h: x => -x, depth: (_x, y) => y, toward: [0, -1] },
  left: { h: (_x, y) => y, depth: x => x, toward: [-1, 0] },
  right: { h: (_x, y) => -y, depth: x => -x, toward: [1, 0] },
};
type Room = ReturnType<typeof deriveRoomsSafe>[number] & { boundaryWallIds: string[] };
export interface SectionStrip { left: number; right: number; room: Room; opened: boolean }
export interface SectionVisibility { side: SectionSide; strips: SectionStrip[] }

/** Primera intersección interior de una estancia, sin atravesar su pared del fondo ni brazos de una planta en L. */
function depthRange(room: Room, h: number, side: SectionSide): [number, number, string | undefined] | null {
  const axis = SECTION_AXES[side], crossings: { depth: number; wallId: string | undefined }[] = [];
  room.boundary.forEach((a, index) => {
    const b = room.boundary[(index + 1) % room.boundary.length]!, ah = axis.h(a.x, a.y), bh = axis.h(b.x, b.y);
    if (Math.abs(bh - ah) < .001 || h < Math.min(ah, bh) || h >= Math.max(ah, bh)) return;
    const t = (h - ah) / (bh - ah);
    crossings.push({ depth: axis.depth(a.x + t * (b.x - a.x), a.y + t * (b.y - a.y)), wallId: room.boundaryWallIds[index] });
  });
  crossings.sort((a, b) => a.depth - b.depth);
  return crossings.length >= 2 ? [crossings[0]!.depth, crossings[1]!.depth, crossings[0]!.wallId] : null;
}

/** En cada franja horizontal solo abre la primera estancia; las del fondo permanecen tras sus tabiques. */
export function sectionVisibility(document: EditorDocument, side: SectionSide): SectionVisibility {
  const walls = new Map(document.walls.map(wall => [wall.id, wall]));
  const rooms: Room[] = deriveRoomsSafe(document).map(room => ({ ...room,
    // Una pared curva aporta varios puntos al contorno, todos con la misma procedencia.
    boundaryWallIds: room.wallIds.flatMap(id => Array.from({ length: wallPath(document, walls.get(id)!).samples().length - 1 }, () => id)) }));
  const axis = SECTION_AXES[side];
  const hidden = new Set(document.walls.filter(wall => wall.hidden).map(wall => wall.id));
  const removed = new Set(editorDocumentToScene(document).exteriorWalls
    .filter(wall => wall.normalX * axis.toward[0] + wall.normalZ * axis.toward[1] > .3).map(wall => wall.sourceEntityId));
  const edges = [...new Set(rooms.flatMap(room => room.boundary.map(p => axis.h(p.x, p.y))))].sort((a, b) => a - b);
  const strips: SectionStrip[] = [];
  for (let i = 1; i < edges.length; i++) {
    const left = edges[i - 1]!, right = edges[i]!, middle = (left + right) / 2;
    if (right - left < 1) continue;
    const first = rooms.map(room => ({ room, range: depthRange(room, middle, side) }))
      .filter((item): item is { room: Room; range: [number, number, string | undefined] } => Boolean(item.range) && !hidden.has(item.range![2] ?? ''))
      .sort((a, b) => a.range[0] - b.range[0])[0];
    if (first) strips.push({ left, right, room: first.room, opened: removed.has(first.range[2] ?? '') });
  }
  return { side, strips };
}
export function sectionPointVisible(layout: SectionVisibility, point: Point, toleranceMm = 1): boolean {
  const axis = SECTION_AXES[layout.side], h = axis.h(point.x, point.y), depth = axis.depth(point.x, point.y);
  return layout.strips.some(strip => {
    if (h < strip.left - toleranceMm || h > strip.right + toleranceMm) return false;
    const range = depthRange(strip.room, Math.max(strip.left + .01, Math.min(strip.right - .01, h)), layout.side);
    return range !== null && depth >= range[0] - toleranceMm && depth <= (strip.opened ? range[1] : range[0]) + toleranceMm;
  });
}

/** Recorta un muro a las franjas de las estancias visibles: no proyectar las paredes de otro recinto sobre ellas. */
export function sectionWallSegments(layout: SectionVisibility, start: Point, end: Point, thickness: number): [Point, Point][] {
  const axis = SECTION_AXES[layout.side], a = axis.h(start.x, start.y), b = axis.h(end.x, end.y);
  if (Math.abs(b - a) < .001) {
    const middle = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    return [start, middle, end].some(p => sectionPointVisible(layout, p, thickness)) ? [[start, end]] : [];
  }
  const pointAt = (h: number) => { const t = (h - a) / (b - a); return { x: start.x + t * (end.x - start.x), y: start.y + t * (end.y - start.y) }; };
  return layout.strips.flatMap(strip => {
    const left = Math.max(strip.left, Math.min(a, b)), right = Math.min(strip.right, Math.max(a, b));
    if (right - left < 1 || !sectionPointVisible(layout, pointAt((left + right) / 2), thickness)) return [];
    return [[pointAt(left), pointAt(right)] as [Point, Point]];
  });
}

export function sectionRoomHint(layout: SectionVisibility, room: Room): string {
  const axis = SECTION_AXES[layout.side], hs = room.boundary.map(p => axis.h(p.x, p.y));
  const left = Math.min(...hs), span = Math.max(...hs) - left;
  const visible = layout.strips.filter(strip => strip.opened && strip.room.id === room.id);
  if (!span || !visible.length) return '';
  const share = visible.reduce((sum, strip) => sum + strip.right - strip.left, 0) / span;
  if (share > .98) return 'Todo su ancho queda abierto; su pared del fondo sigue tapando otras estancias.';
  const ranges = visible.map(strip => `${Math.round((strip.left - left) / span * 100)}–${Math.round((strip.right - left) / span * 100)} %`).join(', ');
  return `Solo quedan abiertas las franjas ${ranges} de su ancho, de izquierda a derecha en esta cámara; el resto está oculto. No traslades muebles de las zonas ocultas a esas franjas.`;
}
