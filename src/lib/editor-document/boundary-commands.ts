import type { EditorDocument, Point } from './schema';
import { type Boundary, type BoundaryGate, boundaryDefaults, isLegacyBoundary } from './boundary-types';
import { upgradeWalkthroughDocument } from './walkthrough';
import { parseEditorDocument } from './validation';
import { transformAroundCenter, localToWorld } from './spatial-properties';

/** Explicit, reversible migration; reading an old plan never changes its entities. */
export function upgradeBoundaryDocument(source: EditorDocument): EditorDocument {
  const doc = upgradeWalkthroughDocument(source);
  doc.schemaVersion = 10;
  doc.boundaries ??= [];
  doc.boundaries.push(...doc.furniture.filter(isLegacyBoundary).map(boundaryDefaults));
  doc.furniture = doc.furniture.filter((item) => !isLegacyBoundary(item));
  for (const level of doc.levels ?? []) if (level.document) level.document = upgradeBoundaryDocument(level.document);
  return parseEditorDocument(doc);
}
export function updateBoundary(source: EditorDocument, id: string, patch: Partial<Omit<Boundary, 'id' | 'kind'>> & { kind?: string }): EditorDocument {
  const doc = upgradeBoundaryDocument(source), index = doc.boundaries!.findIndex((b) => b.id === id);
  if (index < 0) throw new Error('Cerramiento no encontrado');
  doc.boundaries![index] = transformAroundCenter<Boundary>(doc.boundaries![index]!, patch as Partial<Boundary>);
  doc.revision++; return parseEditorDocument(doc);
}
export function putBoundaryGate(source: EditorDocument, boundaryId: string, gate: BoundaryGate): EditorDocument {
  const doc = upgradeBoundaryDocument(source), boundary = doc.boundaries!.find((b) => b.id === boundaryId);
  if (!boundary) throw new Error('Cerramiento no encontrado');
  const gates = boundary.construction.gates, index = gates.findIndex((g) => g.id === gate.id);
  if (index < 0) gates.push(gate); else gates[index] = gate;
  doc.revision++; return parseEditorDocument(doc);
}
export function addBoundaryGate(source: EditorDocument, id: string, positionMm?: number) {
  const doc = upgradeBoundaryDocument(source), b = doc.boundaries!.find((b) => b.id === id);
  if (!b) throw new Error('Cerramiento no encontrado');
  return putBoundaryGate(doc, id, { id: crypto.randomUUID(), positionMm: positionMm ?? b.widthMm / 2,
    widthMm: 1000, heightMm: Math.min(b.heightMm, 2100), hinge: 'left', openAngleDeg: 0, color: b.color });
}
export function splitBoundary(source: EditorDocument, id: string, positionMm: number): EditorDocument {
  const doc = upgradeBoundaryDocument(source), b = doc.boundaries!.find((b) => b.id === id);
  if (!b || positionMm < 50 || positionMm > b.widthMm - 50) throw new Error('Punto de división inválido');
  if (b.construction.gates.some((g) => Math.abs(g.positionMm - positionMm) < g.widthMm / 2 + b.construction.postSizeMm))
    throw new Error('La división invade una puerta o su poste');
  const origin = localToWorld(b, { x: positionMm, y: 0 });
  const other: Boundary = { ...structuredClone(b), ...origin, id: crypto.randomUUID(), widthMm: b.widthMm - positionMm };
  b.widthMm = positionMm;
  other.construction.gates = other.construction.gates.filter((g) => g.positionMm > positionMm).map((g) => ({ ...g, positionMm: g.positionMm - positionMm }));
  b.construction.gates = b.construction.gates.filter((g) => g.positionMm < positionMm);
  doc.boundaries!.push(other); doc.revision++; return parseEditorDocument(doc);
}
export function projectBoundary(b: Boundary, point: Point) {
  const a = b.rotation * Math.PI / 180;
  return (point.x - b.x) * Math.cos(a) + (point.y - b.y) * Math.sin(a);
}
