import type { EditorDocument, Opening } from './schema';
import { OPENING_TYPES, openingType } from './opening-types';
import { openingLookControls, openingTypeLookPatch } from './opening-look';
import { upgradeConstructionDocument } from './migrations';
import { parseEditorDocument } from './validation';
import { assertOpeningClearanceNotWorse } from './opening-clearance';
import { wallFloorElevation } from './floor-level';
import { deriveRooms } from './rooms';
import { eligibleCeilingRooms } from './ceiling-geometry';
import { assertSpatialPlacement } from '@/canvas/editor-v2/spatial-placement';

export const ENTRANCE_DOOR_TYPE_ID = 'puerta-entrada';

type LookFields = Pick<Opening, 'leafDesign' | 'leafFinish' | 'handle' | 'frameFinish'>;
const LOOK_KEYS = ['leafDesign', 'leafFinish', 'handle', 'frameFinish'] as const;

/**
 * Cambia el tipo de una puerta o ventana. Las medidas por defecto del tipo solo se aplican si caben: entre esquinas,
 * sin pisar otra abertura, bajo la coronación del muro y sin chocar con muebles. Si no, prueba solo altura y cota,
 * después solo el ancho y, por último, conserva las medidas actuales con el tipo nuevo (recortando el ancho al máximo
 * real del tipo). Toma el diseño y el tirador del tipo; el acabado elegido se conserva si el tipo nuevo lo admite.
 */
export function setOpeningType(input: EditorDocument, id: string, typeId: string): EditorDocument {
  const doc = upgradeConstructionDocument(input);
  const opening = doc.openings.find((item) => item.id === id);
  if (!opening) throw new Error('Abertura no encontrada');
  const type = OPENING_TYPES.find((item) => item.id === typeId);
  if (!type || type.kind !== opening.kind) throw new Error('Ese tipo no corresponde a esta abertura');
  const wall = doc.walls.find((item) => item.id === opening.wallId);
  if (!wall) throw new Error('Abertura sin muro');
  // La cota del tipo se mide desde el suelo de la estancia del muro, como al colocar la abertura.
  const width: Partial<Opening> = { widthMm: type.widthMm };
  const vertical: Partial<Opening> = { heightMm: type.heightMm, elevationMm: type.elevationMm + wallFloorElevation(doc, wall) };
  const keep: Partial<Opening> = opening.widthMm > type.maxWidthMm ? { widthMm: type.maxWidthMm } : {};
  const controls = openingLookControls(type), look: LookFields = openingTypeLookPatch(type);
  if (controls.finish && opening.leafFinish) look.leafFinish = opening.leafFinish;
  if (controls.frameFinish && opening.frameFinish) look.frameFinish = opening.frameFinish;
  let failure: unknown;
  for (const patch of [{ ...width, ...vertical }, { ...keep, ...vertical }, width, keep]) {
    try {
      const candidate = structuredClone(doc);
      const target = candidate.openings.find((item) => item.id === id)!;
      for (const key of LOOK_KEYS) delete target[key];
      Object.assign(target, patch, look, { catalogId: type.id });
      const next = parseEditorDocument(candidate);
      assertOpeningClearanceNotWorse(doc, next, target);
      assertSpatialPlacement(doc, next);
      return next;
    } catch (error) { failure = error; }
  }
  throw failure instanceof Error ? failure : new Error('El tipo no cabe en esta posición');
}

const facadeCache = new WeakMap<EditorDocument, ReadonlySet<string>>();

/**
 * Muros de fachada a la calle: delimitan una sola estancia y es interior. La pared compartida con un patio
 * delimita dos (la casa y el patio), así que su puerta no se ofrece como puerta de entrada.
 */
export function streetFacadeWallIds(doc: EditorDocument): ReadonlySet<string> {
  const cached = facadeCache.get(doc);
  if (cached) return cached;
  let facade = new Set<string>();
  try {
    const rooms = deriveRooms(doc), indoor = new Set(eligibleCeilingRooms(doc).map((room) => room.id));
    facade = new Set(doc.walls.filter((wall) => !wall.hidden).map((wall) => wall.id).filter((wallId) => {
      const adjacent = rooms.filter((room) => room.wallIds.includes(wallId));
      return adjacent.length === 1 && indoor.has(adjacent[0]!.id);
    }));
  } catch { /* Sin estancias cerradas no hay fachada: se usa la puerta básica. */ }
  facadeCache.set(doc, facade);
  return facade;
}

/** Tipo que se ofrece al colocar una puerta nueva: la de entrada en una fachada a la calle, la básica en el resto. */
export function defaultDoorTypeId(doc: EditorDocument, wallId: string): string {
  return streetFacadeWallIds(doc).has(wallId) ? ENTRANCE_DOOR_TYPE_ID : 'puerta-basic';
}

/** Puerta recién colocada en fachada: pasa a puerta de entrada si cabe; si no, se queda como estaba. */
export function applyDefaultDoorType(before: EditorDocument, placed: EditorDocument, id: string, wallId: string): EditorDocument {
  if (defaultDoorTypeId(before, wallId) !== ENTRANCE_DOOR_TYPE_ID) return placed;
  return applyChosenOpeningType(placed, id, ENTRANCE_DOOR_TYPE_ID);
}

/**
 * Abertura que sigue al ratón al colocar. Con un tipo elegido lleva su ancho y alto desde la previsualización;
 * la cota se aplica al soltarla, porque se mide desde el suelo de la estancia del muro.
 * Un tipo desconocido o de otra clase se ignora y queda la abertura básica.
 */
export function openingPrototype(id: string, kind: Opening['kind'], typeId?: string | null): Opening {
  const type = typeId ? OPENING_TYPES.find((item) => item.id === typeId && item.kind === kind) : undefined;
  return { id, kind, wallId: '', position: .5, widthMm: type?.widthMm ?? (kind === 'ventana' ? 1200 : 900),
    dimensionalOrigin: 'physical', ...(type ? { catalogId: type.id, heightMm: type.heightMm } : {}) };
}

/** Abertura recién colocada con un tipo elegido: toma sus medidas si caben; si no, conserva las suyas con ese tipo. */
export function applyChosenOpeningType(placed: EditorDocument, id: string, typeId: string): EditorDocument {
  try { return setOpeningType(placed, id, typeId); } catch { return placed; }
}

/**
 * Elige diseño de hoja, acabado, tirador o marco de una puerta o ventana. Solo se aceptan las partes que su tipo admite;
 * `undefined` devuelve esa parte a la del tipo.
 */
export function setOpeningLook(input: EditorDocument, id: string, patch: Partial<LookFields>): EditorDocument {
  const doc = upgradeConstructionDocument(input);
  const opening = doc.openings.find((item) => item.id === id);
  if (!opening) throw new Error('Abertura no encontrada');
  const controls = openingLookControls(openingType(opening));
  const allowed: Record<(typeof LOOK_KEYS)[number], boolean> = { leafDesign: controls.design, leafFinish: controls.finish,
    handle: controls.handle, frameFinish: controls.frameFinish };
  for (const key of LOOK_KEYS) {
    if (!(key in patch)) continue;
    if (!allowed[key]) throw new Error('Este tipo de abertura no admite esa opción');
    const value = patch[key];
    if (value === undefined) delete opening[key];
    else Object.assign(opening, { [key]: value });
  }
  return parseEditorDocument(doc);
}
