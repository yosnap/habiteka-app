import type { EditorDocument, Point } from './schema';
import { KITCHEN_SLOT_DEFAULTS, type KitchenRun, type KitchenSlot, type KitchenSlotKind, kitchenRunDefaults } from './kitchen-run-types';
import { upgradeBoundaryDocument } from './boundary-commands';
import { parseEditorDocument } from './validation';
import { localToWorld, projectAlong, transformAroundCenter } from './spatial-properties';
import { floorElevationAt } from './floor-level';
import { slotSpan, type Span } from './kitchen-run-volumes';
import { kitchenRunObstacles } from './kitchen-run-obstacles';

/** Migración explícita y reversible: leer un plano antiguo nunca lo cambia. */
export function upgradeKitchenDocument(source: EditorDocument): EditorDocument {
  const doc = upgradeBoundaryDocument(source);
  if (doc.schemaVersion < 11) doc.schemaVersion = 11;
  doc.kitchenRuns ??= [];
  for (const level of doc.levels ?? []) if (level.document) level.document = upgradeKitchenDocument(level.document);
  return parseEditorDocument(doc);
}
const find = (doc: EditorDocument, id: string) => {
  const run = doc.kitchenRuns!.find((r) => r.id === id);
  if (!run) throw new Error('Mueble de cocina no encontrado');
  return run;
};
/** Se traza por la línea trasera (la que apoya en el muro); el cuerpo queda a la izquierda del sentido de trazado. */
export function addKitchenRun(source: EditorDocument, from: Point, to: Point, options: Partial<Pick<KitchenRun, 'depthMm' | 'heightMm' | 'color'>> = {}): EditorDocument {
  const dx = to.x - from.x, dy = to.y - from.y, length = Math.hypot(dx, dy);
  if (length < 300) throw new Error('El mueble de cocina debe medir al menos 30 cm');
  const doc = upgradeKitchenDocument(source);
  const run = kitchenRunDefaults({ id: crypto.randomUUID(), x: from.x, y: from.y, widthMm: length, rotation: Math.atan2(dy, dx) * 180 / Math.PI, ...options });
  run.elevationMm = floorElevationAt(doc, localToWorld(run, { x: run.widthMm / 2, y: run.depthMm / 2 }));
  doc.kitchenRuns!.push(run); doc.revision++;
  return parseEditorDocument(doc);
}
export function updateKitchenRun(source: EditorDocument, id: string, patch: Partial<Omit<KitchenRun, 'id' | 'kind' | 'catalogId'>> & { kind?: string; catalogId?: string }): EditorDocument {
  const doc = upgradeKitchenDocument(source), index = doc.kitchenRuns!.findIndex((r) => r.id === id);
  if (index < 0) throw new Error('Mueble de cocina no encontrado');
  doc.kitchenRuns![index] = transformAroundCenter<KitchenRun>(doc.kitchenRuns![index]!, patch as Partial<KitchenRun>);
  doc.revision++; return parseEditorDocument(doc);
}
const overlaps = (a: Span, b: Span) => a.from < b.to && a.to > b.from;
export function putKitchenSlot(source: EditorDocument, runId: string, slot: KitchenSlot): EditorDocument {
  const doc = upgradeKitchenDocument(source), run = find(doc, runId), slots = run.kitchen.slots, index = slots.findIndex((s) => s.id === slot.id);
  if (kitchenRunObstacles(doc, run).base.some((cut) => overlaps(slotSpan(slot), cut))) throw new Error('El aparato cae sobre el hueco de un pilar');
  if (index < 0) slots.push(slot); else slots[index] = slot;
  doc.revision++; return parseEditorDocument(doc);
}
/** Primer hueco libre del tramo donde cabe un aparato de ese ancho, empezando por el centro y alternando hacia los extremos. */
export function freeSlotPosition(run: KitchenRun, widthMm: number, blocked: Span[] = []): number | undefined {
  const fits = (centre: number) => centre - widthMm / 2 >= 0 && centre + widthMm / 2 <= run.widthMm
    && [...run.kitchen.slots.map(slotSpan), ...blocked].every((span) => centre + widthMm / 2 <= span.from || centre - widthMm / 2 >= span.to);
  for (let offset = 0; offset <= run.widthMm / 2; offset += 50)
    for (const centre of [run.widthMm / 2 - offset, run.widthMm / 2 + offset]) if (fits(centre)) return centre;
  return undefined;
}
export function addKitchenSlot(source: EditorDocument, runId: string, kind: KitchenSlotKind, positionMm?: number): EditorDocument {
  const doc = upgradeKitchenDocument(source), run = find(doc, runId), defaults = KITCHEN_SLOT_DEFAULTS[kind];
  const centre = positionMm ?? freeSlotPosition(run, defaults.widthMm, kitchenRunObstacles(doc, run).base);
  if (centre === undefined) throw new Error('No queda hueco libre en el tramo para este aparato');
  return putKitchenSlot(doc, runId, { id: crypto.randomUUID(), kind, positionMm: centre, widthMm: defaults.widthMm, color: defaults.color });
}
export function removeKitchenSlot(source: EditorDocument, slotId: string): EditorDocument {
  const doc = upgradeKitchenDocument(source);
  for (const run of doc.kitchenRuns!) run.kitchen.slots = run.kitchen.slots.filter((s) => s.id !== slotId);
  doc.revision++; return parseEditorDocument(doc);
}
export function splitKitchenRun(source: EditorDocument, id: string, positionMm: number): EditorDocument {
  const doc = upgradeKitchenDocument(source), run = find(doc, id);
  if (positionMm < 300 || positionMm > run.widthMm - 300) throw new Error('Punto de división inválido');
  if (run.kitchen.slots.some((s) => { const span = slotSpan(s); return span.from < positionMm && span.to > positionMm; })) throw new Error('La división atraviesa un aparato');
  const origin = localToWorld(run, { x: positionMm, y: 0 });
  const other: KitchenRun = { ...structuredClone(run), ...origin, id: crypto.randomUUID(), widthMm: run.widthMm - positionMm };
  run.widthMm = positionMm;
  other.kitchen.slots = other.kitchen.slots.filter((s) => s.positionMm > positionMm).map((s) => ({ ...s, positionMm: s.positionMm - positionMm }));
  run.kitchen.slots = run.kitchen.slots.filter((s) => s.positionMm < positionMm);
  doc.kitchenRuns!.push(other); doc.revision++; return parseEditorDocument(doc);
}
/** Coordenada longitudinal de un punto del plano sobre el tramo. */
export const projectKitchenRun = (run: KitchenRun, point: Point) => projectAlong(run, point);
