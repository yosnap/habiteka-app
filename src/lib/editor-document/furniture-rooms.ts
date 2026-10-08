import type { FurnitureCatalogEntry, FurnitureRoom } from './furniture-catalog';

type RoomRule = readonly [RegExp, FurnitureRoom];

/**
 * Estancia de los muebles fabricados que su familia dejó en otra porque la estancia aún no existía (la lavadora en el
 * baño o la cocina, el zapatero en el salón). Se decide por el nombre del producto, así sirve también para las piezas
 * que se fabriquen después. Los sanitarios no se mueven: un «lavabo de consola» sigue siendo del baño.
 */
const PRODUCT_ROOMS: readonly RoomRule[] = [
  [/lavadora|secadora|lavadero|tendedero|termo[-_]electrico|caldera/, 'lavadero'],
  [/zapatero|perchero|recibidor|consola/, 'recibidor'],
  [/cuna|litera|cama[-_]nido|infantil|juvenil|cambiador/, 'infantil'],
  [/garaje|banco[-_](de[-_])?trabajo|estanteria[-_]metal/, 'garaje'],
];
const SANITARY_PROFILES = new Set(['sink', 'toilet', 'bath', 'shower']);

/** La pieza con la estancia que le corresponde por su producto; las demás quedan igual. */
export function withProductRoom(entry: FurnitureCatalogEntry): FurnitureCatalogEntry {
  if (SANITARY_PROFILES.has(entry.profile)) return entry;
  const room = PRODUCT_ROOMS.find(([pattern]) => pattern.test(entry.productId))?.[1];
  return room && room !== entry.room ? { ...entry, room } : entry;
}

const isSingleBed = (entry: FurnitureCatalogEntry) => entry.profile === 'bed' && entry.widthMm <= 1300;
const matches = (pattern: RegExp) => (entry: FurnitureCatalogEntry) => pattern.test(entry.id);

/**
 * Piezas que sirven también en otra estancia: el filtro del catálogo, la lectura del boceto y Amueblar las ofrecen en
 * las dos. La estancia propia de cada pieza no cambia.
 */
const ALSO_IN: readonly (readonly [FurnitureRoom, (entry: FurnitureCatalogEntry) => boolean])[] = [
  ['dormitorio', matches(/litera/)],
  ['salon', matches(/chillout/)],
  ['dormitorio', (entry) => entry.profile === 'curtain' || entry.profile === 'curtain-open'],
  ['infantil', (entry) => entry.profile === 'curtain' || entry.profile === 'curtain-open'],
  ['salon', (entry) => entry.profile === 'curtain' || entry.profile === 'curtain-open'],
  // Infantil: camas individuales (90 y 105) y lo que acompaña a la cama, el estudio y la ropa.
  ['infantil', (entry) => isSingleBed(entry)
    || matches(/escritorio|silla[-_]oficina|armario|comoda|mesita|mesilla|libreria|estanteria[-_]cubos|cesto/)(entry)],
  // Recibidor: muebles estrechos de guardar, bancos para calzarse y aparadores que hacen de consola.
  ['recibidor', matches(/mueble[-_]columna|banco[-_](comedor|madera)|aparador[-_]industrial|cajonera[-_]baja/)],
  // Lavadero: lo que guarda los productos y la ropa.
  ['lavadero', matches(/mueble[-_]columna|cesto|estanteria[-_](oficina|acero)/)],
  // Lavadora y secadora se instalan también en el baño o la cocina.
  ['bano', matches(/lavadora|secadora|cesto/)],
  ['cocina', matches(/lavadora|secadora/)],
  // Garaje: solo estanterías metálicas.
  ['garaje', matches(/estanteria[-_](oficina|acero)/)],
];

/** Estancias en que se ofrece la pieza: la suya primero y después aquellas en que también sirve. */
export function furnitureRooms(entry: FurnitureCatalogEntry): FurnitureRoom[] {
  return [entry.room, ...ALSO_IN.filter(([room, test]) => room !== entry.room && test(entry)).map(([room]) => room)];
}
