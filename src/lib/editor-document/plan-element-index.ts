import type { EditorDocument, Point } from './schema';
import type { DerivedRoom } from './rooms';
import { planObjects } from './boundary-types';
import { elementName } from './element-classification';
import { wallPath } from './wall-path';
import { localToWorld } from './spatial-properties';
import { insideRoom } from './ceiling-geometry';
import { isRampLanding } from './ramp-kind';
import { KITCHEN_SLOT_DEFAULTS } from './kitchen-run-types';

export interface PlanElementEntry { id: string; label: string; group: string; point: Point }

const named = (name: string | undefined, fallback: string) => name?.trim() || fallback;
const centroid = (points: Point[]): Point => ({ x: points.reduce((s, p) => s + p.x, 0) / points.length, y: points.reduce((s, p) => s + p.y, 0) / points.length });

/** Índice plano de todo lo seleccionable, con nombre legible y punto para centrar la vista. Alimenta el buscador y el desplegable. */
export function planElementIndex(doc: EditorDocument, rooms: DerivedRoom[]): PlanElementEntry[] {
  const roomName = (room: DerivedRoom, index: number) => doc.labels.find((label) => insideRoom(label, room.boundary))?.text
    ?? (room.wallIds.some((id) => id.startsWith('outdoor:')) ? `Patio ${index + 1}` : `Estancia ${index + 1}`);
  return [
    ...(doc.terrainSurfaces ?? []).map((surface) => ({ id: surface.id, label: surface.name, group: 'Terreno',
      point: { x: surface.x + surface.widthMm / 2, y: surface.y + surface.depthMm / 2 } })),
    ...rooms.map((room, i) => ({ id: room.id, label: roomName(room, i), group: 'Estancias', point: centroid(room.boundary) })),
    ...doc.walls.filter((w) => !w.hidden).map((w, i) => ({ id: w.id, label: named(w.name, `Pared ${i + 1}`), group: 'Paredes', point: wallPath(doc, w).at(.5) })),
    ...doc.openings.map((o, i) => { const wall = doc.walls.find((w) => w.id === o.wallId);
      return { id: o.id, label: named(o.name, `${o.kind} ${i + 1}`), group: 'Aberturas', point: wall ? wallPath(doc, wall).at(o.position) : { x: 0, y: 0 } }; }),
    ...(doc.stairs ?? []).map((s, i) => ({ id: s.id, label: named(s.name, `Escalera ${s.kind} ${i + 1}`), group: 'Construcción', point: s })),
    ...(doc.ramps ?? []).map((r, i) => ({ id: r.id, label: named(r.name, `${isRampLanding(r) ? 'Descansillo' : 'Rampa'} ${i + 1}`), group: 'Construcción', point: r })),
    ...(doc.columns ?? []).map((c, i) => ({ id: c.id, label: named(c.name, `Columna ${i + 1}`), group: 'Construcción', point: c })),
    ...planObjects(doc).map((item) => ({ id: item.id, label: elementName(item), group: 'Objetos', point: localToWorld(item, { x: item.widthMm / 2, y: item.depthMm / 2 }) })),
    ...(doc.boundaries ?? []).flatMap((b) => b.construction.gates.map((g, i) => ({ id: g.id, label: `Puerta ${i + 1} · ${elementName(b)}`, group: 'Objetos', point: localToWorld(b, { x: g.positionMm, y: b.depthMm / 2 }) }))),
    ...(doc.kitchenRuns ?? []).flatMap((run) => run.kitchen.slots.map((s) => ({ id: s.id, label: `${KITCHEN_SLOT_DEFAULTS[s.kind].label} · ${elementName(run)}`, group: 'Objetos', point: localToWorld(run, { x: s.positionMm, y: run.depthMm / 2 }) }))),
    ...doc.labels.filter((l) => !rooms.some((r) => insideRoom(l, r.boundary))).map((l) => ({ id: l.id, label: l.text, group: 'Textos', point: l })),
  ].map((entry) => ({ ...entry, point: { x: entry.point.x, y: entry.point.y } }));
}

/** Coincidencia sin acentos ni mayúsculas, por palabras sueltas. */
export function matchesQuery(entry: PlanElementEntry, query: string): boolean {
  const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const haystack = fold(`${entry.group} ${entry.label}`);
  return fold(query).split(/\s+/).filter(Boolean).every((word) => haystack.includes(word));
}
