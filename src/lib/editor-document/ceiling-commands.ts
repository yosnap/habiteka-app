import type { Ceiling, EditorDocument, Luminaire, Point } from './schema';
import { parseEditorDocument } from './validation';
import { upgradeRampDocument } from './spatial-properties';
import { ceilingSurfaces, luminairePlacementIssue, eligibleCeilingRooms } from './ceiling-geometry';
import { interiorPoint } from '@/canvas/editor-v2/editing-operations';
import type { LightingProposal } from './lighting-proposal';

/** Edición explícita: leer un documento histórico no añade techo ni luces. */
export function upgradeCeilingDocument(source: EditorDocument): EditorDocument {
  const doc = upgradeRampDocument(source);
  if (doc.schemaVersion < 8) {
    doc.schemaVersion = 8;
    doc.ceilings = [];
    doc.luminaires = [];
  }
  return parseEditorDocument(doc);
}
export function setRoomCeiling(source: EditorDocument, roomId: string, patch: Partial<Pick<Ceiling, 'kind' | 'dropMm' | 'color'>> = {}): EditorDocument {
  if (!eligibleCeilingRooms(source).some((room) => room.id === roomId)) throw new Error('Elige una habitación interior cerrada');
  const doc = upgradeCeilingDocument(source);
  const existing = doc.ceilings!.find((ceiling) => ceiling.roomId === roomId);
  const kind = patch.kind ?? existing?.kind ?? 'plain';
  const ceiling: Ceiling = { id: existing?.id ?? crypto.randomUUID(), roomId, kind,
    color: patch.color ?? existing?.color ?? '#f4f1e9',
    dropMm: kind === 'plain' ? 0 : patch.dropMm ?? (existing?.kind === 'suspended' ? existing.dropMm : 150) };
  doc.ceilings = [...doc.ceilings!.filter((item) => item.id !== ceiling.id), ceiling];
  parseEditorDocument(doc);
  if (!ceilingSurfaces(doc).some((surface) => surface.ceiling.id === ceiling.id)) throw new Error('Conserva al menos 2,10 m de altura libre bajo el techo');
  for (const light of doc.luminaires!.filter((item) => item.ceilingId === ceiling.id)) assertLightPlacement(doc, light);
  return doc;
}
export function removeCeiling(source: EditorDocument, id: string): EditorDocument {
  const doc = parseEditorDocument(source);
  doc.ceilings = doc.ceilings?.filter((item) => item.id !== id);
  doc.luminaires = doc.luminaires?.filter((item) => item.ceilingId !== id);
  return parseEditorDocument(doc);
}
export function addLuminaire(source: EditorDocument, ceilingId: string, kind: Luminaire['kind'], point?: Point): EditorDocument {
  const doc = upgradeCeilingDocument(source);
  const surface = ceilingSurfaces(doc).find((item) => item.ceiling.id === ceilingId);
  if (!surface) throw new Error('Selecciona un techo válido');
  const light: Luminaire = { id: crypto.randomUUID(), ceilingId, kind,
    ...(point ?? interiorPoint(surface.room.boundary)), dropMm: kind === 'pendant' ? Math.max(0, Math.min(350, surface.heightMm - 2320)) : 0,
    color: '#e8dfcf', temperatureK: 3000, lumens: kind === 'recessed' ? 650 : 1200, enabled: true };
  doc.luminaires!.push(light);
  parseEditorDocument(doc);
  assertLightPlacement(doc, light);
  return doc;
}
export function updateLuminaire(source: EditorDocument, id: string, patch: Partial<Omit<Luminaire, 'id' | 'ceilingId'>>): EditorDocument {
  const doc = parseEditorDocument(source);
  const light = doc.luminaires?.find((item) => item.id === id);
  if (!light) throw new Error('Luminaria inexistente');
  Object.assign(light, patch);
  if (patch.kind && patch.kind !== 'pendant') light.dropMm = 0;
  parseEditorDocument(doc);
  assertLightPlacement(doc, light);
  return doc;
}
export function removeLuminaire(source: EditorDocument, id: string): EditorDocument {
  const doc = parseEditorDocument(source);
  doc.luminaires = doc.luminaires?.filter((item) => item.id !== id);
  return parseEditorDocument(doc);
}
/** Se valida contra el documento ACTUAL, incluso si cambió mientras se revisaba la propuesta. */
export function applyLightingProposal(source: EditorDocument, proposal: LightingProposal): EditorDocument {
  const doc = upgradeCeilingDocument(source);
  if (!ceilingSurfaces(doc).some((surface) => surface.ceiling.id === proposal.ceilingId)) throw new Error('El techo de la propuesta ya no está disponible');
  if (!proposal.lights.length || proposal.lights.length > 12) throw new Error('Revisa la propuesta: debe contener entre 1 y 12 luminarias');
  const lights = proposal.lights.map((item) => ({ ...item, id: crypto.randomUUID() }));
  if (lights.some((item) => item.ceilingId !== proposal.ceilingId)) throw new Error('La propuesta contiene luminarias de otro techo');
  doc.luminaires!.push(...lights);
  parseEditorDocument(doc);
  lights.forEach((light) => assertLightPlacement(doc, light));
  return doc;
}
function assertLightPlacement(doc: EditorDocument, light: Luminaire): void {
  const issue = luminairePlacementIssue(doc, light);
  if (issue) throw new Error(issue);
}
