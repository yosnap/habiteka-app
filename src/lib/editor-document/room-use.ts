import { FURNITURE_ROOMS, normalizeFurnitureSearch, type FurnitureRoom } from './furniture-catalog';

/**
 * Uso de una estancia según el nombre rotulado en el plano. El orden importa: lo concreto antes que lo general
 * («Dormitorio infantil» es infantil; «Salón-comedor», comedor; «Cocina-lavadero», cocina; «Porche de entrada»,
 * exterior). Las palabras cortas van enteras para que «niño» no salga de otra palabra.
 */
const ROOM_PATTERNS: readonly (readonly [FurnitureRoom, RegExp])[] = [
  ['infantil', /infantil|juvenil|\bnin[oa]s?\b|\bbebes?\b|\bkids?\b|nursery|playroom|(cuarto|sala|zona) de juegos/],
  ['dormitorio', /dorm|habitacion|bedroom|\bsuite\b/],
  ['cocina', /cocina|kitchen|despensa/],
  ['bano', /bano|aseo|\bwc\b|lavabo|b°|bº|bathroom/],
  ['lavadero', /lavadero|lavanderia|tendedero|\bplancha\b|laundry|utility/],
  ['comedor', /comedor|dining/],
  ['salon', /salon|\bsala\b|living|\bestar\b|pasillo|vestidor/],
  ['oficina', /estudio|oficina|despacho|office/],
  ['garaje', /garaje|cochera|parking|aparcamiento|garage|carport/],
  ['exterior', /terraza|patio|jardin|porche|loggia|balcon|garden|piscina/],
  ['recibidor', /recibidor|entrada|\bhall\b|vestibulo|zaguan|foyer|\bentry\b/],
];

/** Estancia del catálogo que sugiere un nombre de estancia o de zona; null si no se reconoce. */
export function roomFromZoneName(name: string): FurnitureRoom | null {
  const normalized = normalizeFurnitureSearch(name);
  return ROOM_PATTERNS.find(([, pattern]) => pattern.test(normalized))?.[0] ?? null;
}

/** Nombre del uso de una estancia para la IA («Infantil», «Garaje»…); vacío si el nombre no lo dice. */
export function roomUseLabel(name: string): string {
  const room = roomFromZoneName(name);
  return room ? FURNITURE_ROOMS[room] : '';
}

/**
 * Qué lleva cada estancia nueva al amueblarla. Son reglas conservadoras: lo imprescindible del uso y nada que estorbe
 * el paso; el garaje es para el coche.
 */
export const ROOM_USE_RULES: Readonly<Partial<Record<FurnitureRoom, string>>> = {
  infantil: 'Infantil: una cama individual (o nido) con su mesilla, un escritorio con su silla y un armario; cuna solo si el cliente la pide y el catálogo la tiene; nunca una cama doble.',
  recibidor: 'Recibidor: contra la pared, una consola o un zapatero (o un mueble estrecho), espejo y perchero si el catálogo los tiene, y un felpudo junto a la puerta de entrada; deja libre el paso de la puerta.',
  lavadero: 'Lavadero: lavadora y secadora juntas contra la pared, la pila si cabe y un armario o una estantería para los productos; sin sofás, camas ni decoración.',
  garaje: 'Garaje: es para el coche; no pongas muebles salvo que el cliente lo pida. Como mucho, una estantería metálica contra la pared del fondo.',
};

/** Reglas de amueblado de los usos presentes entre esas estancias; vacío si ninguna las necesita. */
export function roomUseRules(names: readonly string[]): string {
  const uses = new Set(names.map(roomFromZoneName));
  const rules = (Object.keys(ROOM_USE_RULES) as FurnitureRoom[]).filter((room) => uses.has(room)).map((room) => ROOM_USE_RULES[room]);
  return rules.length ? `Uso de cada estancia (campo uso, deducido de su nombre). ${rules.join(' ')}` : '';
}
