import type { Ceiling, EditorDocument, Luminaire, Point } from './schema';
import { parseEditorDocument } from './validation';
import { upgradeRampDocument } from './spatial-properties';
import { ceilingSurfaces, luminairePlacementIssue, eligibleCeilingRooms, MIN_FREE_HEIGHT_MM } from './ceiling-geometry';
import { interiorPoint } from '@/canvas/editor-v2/editing-operations';
import type { LightingProposal } from './lighting-proposal';
// Ciclo de módulos tolerado: solo se usa dentro de funciones, nunca al cargar.
import { upgradeLightingDocument } from './lighting-migration';
import { floorFinish } from './floor-finishes';
import { pruneLightingScenes } from './lighting-scene';
import { addCoveStrip } from './light-strip-commands';

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
/**
 * Tope del descenso del falso techo. El campo se escribe en CENTÍMETROS, y sin
 * tope era fácil teclear 150 pensando en milímetros y pedir 1,5 m de descenso.
 * Único sitio donde vive el límite: paneles, validación y comandos lo leen aquí.
 */
export const MAX_CEILING_DROP_MM = 600;
export { MIN_FREE_HEIGHT_MM } from './ceiling-geometry';
const metres = (mm: number) => `${(mm / 1000).toFixed(2).replace('.', ',')} m`;

/** Descenso mínimo que el esquema exige a un falso techo. */
export const MIN_CEILING_DROP_MM = 80;

/**
 * Centímetros tecleados → milímetros válidos. Acota el campo en el sitio donde
 * se escribe para que 150 (cm) no acabe pidiendo 1,5 m de descenso.
 */
export function ceilingDropMm(valueCm: number): number {
  if (!Number.isFinite(valueCm)) return MIN_CEILING_DROP_MM;
  return Math.round(Math.min(MAX_CEILING_DROP_MM, Math.max(MIN_CEILING_DROP_MM, valueCm * 10)));
}

/**
 * Motivo concreto por el que ese techo no cabe en la estancia: con cuánto
 * descenso, qué altura libre quedaría y cuál es el mínimo. Sin un motivo
 * geométrico concreto devuelve el genérico de cierre o altura de muros.
 */
function ceilingDropIssue(doc: EditorDocument, ceiling: Ceiling): string {
  const flat = ceilingSurfaces({ ...doc, ceilings: doc.ceilings!.map((item) => item.id === ceiling.id ? { ...item, kind: 'plain' as const, dropMm: 0 } : item) })
    .find((surface) => surface.ceiling.id === ceiling.id);
  if (!flat) return 'Ni siquiera un techo plano cabe en esta estancia: revisa su cierre y la altura de los muros.';
  const free = flat.heightMm - ceiling.dropMm - (floorFinish(doc, ceiling.roomId).elevationMm ?? 0);
  return `Con ${Math.round(ceiling.dropMm / 10)} cm de descenso quedan ${metres(Math.max(0, free))} libres; el mínimo es ${metres(MIN_FREE_HEIGHT_MM)}.`;
}

export function setRoomCeiling(source: EditorDocument, roomId: string, patch: Partial<Pick<Ceiling, 'kind' | 'dropMm' | 'color'>> = {}): EditorDocument {
  if (!eligibleCeilingRooms(source).some((room) => room.id === roomId)) throw new Error('Elige una habitación interior cerrada');
  const doc = upgradeLightingDocument(source);
  const existing = doc.ceilings!.find((ceiling) => ceiling.roomId === roomId);
  const kind = patch.kind ?? existing?.kind ?? 'plain';
  const ceiling: Ceiling = { id: existing?.id ?? crypto.randomUUID(), roomId, kind,
    color: patch.color ?? existing?.color ?? '#f4f1e9',
    dropMm: kind === 'plain' ? 0 : patch.dropMm ?? (existing?.kind === 'suspended' ? existing.dropMm : 150) };
  if (ceiling.dropMm > MAX_CEILING_DROP_MM)
    throw new Error(`El descenso del falso techo se indica en centímetros: como mucho ${MAX_CEILING_DROP_MM / 10} cm.`);
  doc.ceilings = [...doc.ceilings!.filter((item) => item.id !== ceiling.id), ceiling];
  parseEditorDocument(doc);
  if (!ceilingSurfaces(doc).some((surface) => surface.ceiling.id === ceiling.id)) throw new Error(ceilingDropIssue(doc, ceiling));
  for (const light of doc.luminaires!.filter((item) => item.ceilingId === ceiling.id)) assertLightPlacement(doc, light);
  return doc;
}
export function removeCeiling(source: EditorDocument, id: string): EditorDocument {
  const doc = parseEditorDocument(source);
  doc.ceilings = doc.ceilings?.filter((item) => item.id !== id);
  doc.luminaires = doc.luminaires?.filter((item) => item.ceilingId !== id);
  // El foseado vive pegado a su techo: sin techo no hay recorrido que seguir.
  doc.lightStrips = doc.lightStrips?.filter((item) => item.ceilingId !== id);
  pruneLightingScenes(doc);
  return parseEditorDocument(doc);
}
export function addLuminaire(source: EditorDocument, ceilingId: string, kind: Luminaire['kind'], point?: Point): EditorDocument {
  const doc = upgradeLightingDocument(source);
  const surface = ceilingSurfaces(doc).find((item) => item.ceiling.id === ceilingId);
  if (!surface) throw new Error('Selecciona un techo válido');
  const light: Luminaire = { id: crypto.randomUUID(), ceilingId, kind,
    ...(point ?? interiorPoint(surface.room.boundary)), dropMm: kind === 'pendant' ? Math.max(0, Math.min(350, surface.heightMm - 2320)) : 0,
    color: '#e8dfcf', temperatureK: 3000, lumens: kind === 'recessed' ? 650 : kind === 'spot' ? 550 : 1200, enabled: true,
    ...(kind === 'spot' ? SPOT_DEFAULTS : {}) };
  // Sin punto elegido, el centro de la estancia suele estar ya ocupado (p. ej. por una
  // propuesta anterior): se busca el hueco libre más cercano en vez de rechazar el alta.
  if (!point) Object.assign(light, freeLuminairePoint(doc, light, surface.room.boundary) ?? {});
  doc.luminaires!.push(light);
  parseEditorDocument(doc);
  assertLightPlacement(doc, light);
  return doc;
}
/**
 * Punto libre para una luz nueva: muestrea la estancia en rejilla y devuelve el
 * candidato válido más cercano al centro, o `null` si no cabe en ninguno (el alta
 * fallará entonces con el motivo real).
 */
function freeLuminairePoint(doc: EditorDocument, light: Luminaire, boundary: readonly Point[]): Point | null {
  const probe = (candidate: Point) => !luminairePlacementIssue({ ...doc, luminaires: [...doc.luminaires!, { ...light, ...candidate }] }, { ...light, ...candidate });
  if (probe(light)) return null;
  const xs = boundary.map((p) => p.x), ys = boundary.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const candidates: Point[] = [];
  for (let row = 1; row < 16; row++) for (let col = 1; col < 16; col++)
    candidates.push({ x: Math.round(minX + (maxX - minX) * col / 16), y: Math.round(minY + (maxY - minY) * row / 16) });
  candidates.sort((a, b) => Math.hypot(a.x - light.x, a.y - light.y) - Math.hypot(b.x - light.x, b.y - light.y));
  return candidates.find(probe) ?? null;
}

/** Montaje, inclinación y giro de partida del foco orientable; un solo sitio para comandos y paneles. */
export const SPOT_DEFAULTS: Required<Pick<Luminaire, 'mount' | 'tiltDeg' | 'azimuthDeg'>> = { mount: 'surface', tiltDeg: 30, azimuthDeg: 0 };

/** Campos que acompañan a un cambio de tipo, también en borradores de propuesta. */
export function luminaireKindPatch(kind: Luminaire['kind']): Partial<Omit<Luminaire, 'id' | 'ceilingId'>> {
  return kind === 'spot'
    ? { kind, dropMm: 0, ...SPOT_DEFAULTS }
    : { kind, dropMm: 0, mount: undefined, tiltDeg: undefined, azimuthDeg: undefined };
}

export function updateLuminaire(source: EditorDocument, id: string, patch: Partial<Omit<Luminaire, 'id' | 'ceilingId'>>): EditorDocument {
  // Estrenar un foco orientable es una edición: sube el documento a v12.
  const orients = patch.kind === 'spot' || patch.mount !== undefined || patch.tiltDeg !== undefined || patch.azimuthDeg !== undefined;
  const doc = orients ? upgradeLightingDocument(source) : parseEditorDocument(source);
  const light = doc.luminaires?.find((item) => item.id === id);
  if (!light) throw new Error('Luminaria inexistente');
  Object.assign(light, patch);
  if (patch.kind && patch.kind !== 'pendant') light.dropMm = 0;
  if (patch.kind === 'spot') {
    light.mount ??= SPOT_DEFAULTS.mount; light.tiltDeg ??= SPOT_DEFAULTS.tiltDeg; light.azimuthDeg ??= SPOT_DEFAULTS.azimuthDeg;
  }
  // Los tipos no orientables no guardan los campos del foco ni con la clave a `undefined`.
  if (light.kind !== 'spot') { delete light.mount; delete light.tiltDeg; delete light.azimuthDeg; }
  else if (light.mount === 'recessed') light.dropMm = 0;
  parseEditorDocument(doc);
  assertLightPlacement(doc, light);
  return doc;
}
export function removeLuminaire(source: EditorDocument, id: string): EditorDocument {
  const doc = parseEditorDocument(source);
  doc.luminaires = doc.luminaires?.filter((item) => item.id !== id);
  // Una escena que apaga una luz borrada dejaría de validar.
  pruneLightingScenes(doc);
  return parseEditorDocument(doc);
}
/** Se valida contra el documento ACTUAL, incluso si cambió mientras se revisaba la propuesta. */
export function applyLightingProposal(source: EditorDocument, proposal: LightingProposal): EditorDocument {
  let doc = upgradeLightingDocument(source);
  if (!ceilingSurfaces(doc).some((surface) => surface.ceiling.id === proposal.ceilingId)) throw new Error('El techo de la propuesta ya no está disponible');
  if (proposal.lights.length > 12) throw new Error('Revisa la propuesta: debe contener como mucho 12 luminarias');
  if (!proposal.lights.length && !proposal.cove) throw new Error('Revisa la propuesta: no contiene ninguna luz');
  const lights = proposal.lights.map((item) => ({ ...item, id: crypto.randomUUID() }));
  if (lights.some((item) => item.ceilingId !== proposal.ceilingId)) throw new Error('La propuesta contiene luminarias de otro techo');
  doc.luminaires!.push(...lights);
  parseEditorDocument(doc);
  lights.forEach((light) => assertLightPlacement(doc, light));
  // El foseado se crea con el mismo comando que el botón del panel: un solo sitio.
  if (proposal.cove) doc = addCoveStrip(doc, proposal.ceilingId);
  return doc;
}
/**
 * Techo para toda la planta: el mismo tipo y acabado en cada estancia interior
 * cerrada, en un solo paso deshacible. Las estancias donde ese techo no cabe
 * (altura libre) se saltan y se devuelven para avisar, en vez de frenar al resto.
 */
export function setCeilingsForAllRooms(source: EditorDocument, patch: Partial<Pick<Ceiling, 'kind' | 'dropMm' | 'color'>> = {}): { document: EditorDocument; applied: number; skipped: number; skippedReason: string | null } {
  let doc = upgradeLightingDocument(source), applied = 0, skipped = 0, skippedReason: string | null = null;
  for (const room of eligibleCeilingRooms(doc)) {
    try { doc = setRoomCeiling(doc, room.id, patch); applied += 1; }
    catch (error) { skipped += 1; skippedReason ??= error instanceof Error ? error.message : null; }
  }
  if (!applied) throw new Error(`Ninguna estancia admite ese techo. ${skippedReason ?? 'Revisa el cierre de las habitaciones y la altura libre.'}`);
  return { document: doc, applied, skipped, skippedReason };
}
/** Mismo cambio en varias luces a la vez; todo o nada, con el motivo del primer fallo. */
export function updateLuminaires(source: EditorDocument, ids: readonly string[], patch: Partial<Omit<Luminaire, 'id' | 'ceilingId' | 'x' | 'y'>>): EditorDocument {
  if (!ids.length) throw new Error('Selecciona al menos una luminaria');
  let doc = source;
  for (const id of ids) {
    try { doc = updateLuminaire(doc, id, patch); }
    catch (error) {
      throw new Error(`No se aplicó a ninguna de las ${ids.length} luces: ${error instanceof Error ? error.message : 'cambio no válido'}`);
    }
  }
  return doc;
}
export function removeLuminaires(source: EditorDocument, ids: readonly string[]): EditorDocument {
  const doc = parseEditorDocument(source), drop = new Set(ids);
  doc.luminaires = doc.luminaires?.filter((item) => !drop.has(item.id));
  pruneLightingScenes(doc);
  return parseEditorDocument(doc);
}
/** Varias propuestas (una por techo) en un solo paso deshacible. */
export function applyLightingProposals(source: EditorDocument, proposals: readonly LightingProposal[]): EditorDocument {
  if (!proposals.length) throw new Error('No hay propuestas que añadir');
  return proposals.reduce((doc, proposal) => applyLightingProposal(doc, proposal), source);
}
function assertLightPlacement(doc: EditorDocument, light: Luminaire): void {
  const issue = luminairePlacementIssue(doc, light);
  if (issue) throw new Error(issue);
}
