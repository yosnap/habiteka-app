/**
 * Tipo de carpintería de las puertas y ventanas de un plano importado. Manda lo que la lectura distinguió en el símbolo
 * (doble hoja, corredera, plegable, balconera…). Lo demás sigue dos reglas de sentido común: la puerta sin otra marca en
 * la fachada a la calle es la de entrada, y un paso de 1,4 m o más entre la casa y un patio o una terraza es una
 * corredera de vidrio (desde 2,8 m, la elevadora de cuatro hojas), igual que una corredera leída en esa pared. Un hueco
 * de 2,2 m o más en la fachada de una estancia rotulada garaje, cochera o parking es una puerta de garaje seccional.
 * Puro y cliente-safe.
 */
import type { EditorDocument } from './schema';
import { OPENING_TYPES, type OpeningType } from './opening-types';
import { ENTRANCE_DOOR_TYPE_ID, streetFacadeWallIds } from './opening-type-commands';
import { deriveRooms } from './rooms';
import { eligibleCeilingRooms } from './ceiling-geometry';
import { pointInPolygon } from './polygon-tools';

/** Ancho a partir del cual un paso a un patio o una terraza se toma por una corredera de vidrio. */
export const WIDE_PATIO_DOOR_MM = 1400;
export const PATIO_DOOR_TYPE_ID = 'puerta-corredera-vidrio';
/** Desde este ancho, la salida a patio o terraza es la corredera elevadora de cuatro hojas. */
export const FOUR_LEAF_PATIO_DOOR_MM = 2800;
export const FOUR_LEAF_PATIO_DOOR_TYPE_ID = 'puerta-corredera-elevadora';

const typeById = (id: string | undefined) => OPENING_TYPES.find((type) => type.id === id);

/** Hueco de fachada que, en un garaje, es la puerta del coche. */
export const GARAGE_DOOR_MIN_MM = 2200;
export const GARAGE_DOOR_TYPE_ID = 'puerta-garaje';
/** Nombre de estancia de garaje: garaje, garage, cochera, parking o aparcamiento (con número o no). */
export const GARAGE_ROOM_NAME = /\b(garajes?|garages?|cocheras?|parkings?|aparcamientos?)\b/i;

/** Muros de fachada (delimitan una sola estancia) de una estancia rotulada garaje, cochera o parking. */
export function garageFacadeWallIds(doc: EditorDocument): ReadonlySet<string> {
  try {
    const rooms = deriveRooms(doc);
    const garages = rooms.filter((room) => doc.labels.some((label) => GARAGE_ROOM_NAME.test(label.text) && pointInPolygon(label, room.boundary)));
    return new Set(doc.walls.filter((wall) => !wall.hidden).map((wall) => wall.id).filter((wallId) => {
      const adjacent = rooms.filter((room) => room.wallIds.includes(wallId));
      return adjacent.length === 1 && garages.includes(adjacent[0]!);
    }));
  } catch {
    // Sin estancias cerradas no hay garaje que reconocer.
    return new Set();
  }
}

/** Muros visibles entre una estancia interior y un patio, una terraza u otro espacio exterior cerrado como estancia. */
export function patioWallIds(doc: EditorDocument): ReadonlySet<string> {
  try {
    const rooms = deriveRooms(doc), indoor = new Set(eligibleCeilingRooms(doc).map((room) => room.id));
    return new Set(doc.walls.filter((wall) => !wall.hidden).map((wall) => wall.id).filter((wallId) => {
      const adjacent = rooms.filter((room) => room.wallIds.includes(wallId));
      return adjacent.length === 2 && adjacent.filter((room) => indoor.has(room.id)).length === 1;
    }));
  } catch {
    // Sin estancias cerradas no hay patio que reconocer: se quedan los tipos leídos.
    return new Set();
  }
}

/**
 * Tipo de cada abertura importada, por su id. `read` trae el tipo que la lectura distinguió; uno desconocido o de otra
 * clase (una ventana con un tipo de puerta) se ignora. Las aberturas que no figuran en el resultado se quedan básicas.
 */
export function importedOpeningTypes(doc: EditorDocument, read: ReadonlyMap<string, string>): Map<string, OpeningType> {
  const types = new Map<string, OpeningType>();
  for (const opening of doc.openings) {
    const type = typeById(read.get(opening.id));
    if (type && type.kind === opening.kind) types.set(opening.id, type);
  }
  if (!doc.openings.length) return types;
  const patio = patioWallIds(doc), facade = streetFacadeWallIds(doc), garage = garageFacadeWallIds(doc);
  // Si la lectura ya señaló la de entrada, las demás puertas de la fachada son secundarias (la de la cocina al huerto).
  const entranceRead = [...types.values()].some((type) => type.id === ENTRANCE_DOOR_TYPE_ID);
  for (const opening of doc.openings) {
    const current = types.get(opening.id);
    // Un hueco ancho en la fachada de la cochera es su puerta de garaje (seccional), si la lectura no dijo otra cosa.
    if (garage.has(opening.wallId) && opening.kind !== 'ventana' && opening.widthMm >= GARAGE_DOOR_MIN_MM && (!current || current.id === 'puerta-basic')) {
      types.set(opening.id, typeById(GARAGE_DOOR_TYPE_ID)!);
    } else if (patio.has(opening.wallId)) {
      const wideWithoutLeaf = !current && opening.kind !== 'ventana' && opening.widthMm >= WIDE_PATIO_DOOR_MM;
      if (current?.id === 'puerta-corredera' || wideWithoutLeaf)
        types.set(opening.id, typeById(opening.widthMm >= FOUR_LEAF_PATIO_DOOR_MM ? FOUR_LEAF_PATIO_DOOR_TYPE_ID : PATIO_DOOR_TYPE_ID)!);
    } else if (!current && !entranceRead && opening.kind === 'puerta' && facade.has(opening.wallId)) {
      types.set(opening.id, typeById(ENTRANCE_DOOR_TYPE_ID)!);
    }
  }
  return types;
}
