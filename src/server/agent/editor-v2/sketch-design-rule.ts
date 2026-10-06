import type { Point } from '@/lib/editor-document/schema';
import type { RoomWallFace } from '@/lib/editor-document/room-wall-faces';
import { pointInPolygon } from '@/lib/editor-document/polygon-tools';
import type { SketchGuide, SketchGuideItem } from './sketch-furniture-guide';
import { getFurnitureCatalogEntry, type FurnitureCatalogEntry } from '@/lib/editor-document/furniture-catalog';
import { COMPANION_RULES, isBarStool } from '@/lib/editor-document/native-design-seating';

/** Lo que en un boceto va contra una pared; mesas, sillas, alfombras y plantas van exentas. */
const SKETCH_WALL_KINDS = new Set(['sofa', 'bed', 'cabinet', 'shelf', 'kitchen', 'sink', 'toilet', 'bath', 'shower', 'appliance', 'bench', 'screen']);
/** Distancia máxima entre el borde dibujado y la cara del muro para considerar que la pieza va contra él. */
const SKETCH_WALL_REACH_MM = 700;

interface SketchRoom { id: string; boundary: Point[]; name: string }

/**
 * Caras de la estancia contra las que va la caja dibujada, de la más cercana a la más lejana. Una cama o un inodoro
 * apoyan su lado corto (cabecero, cisterna) y lo demás el largo; si la lectura dice dónde queda la trasera y cuadra con
 * esa forma, manda esa pared (la IA de lectura acierta el lado del fregadero, pero a veces gira una cama).
 */
export function sketchWalls(faces: readonly RoomWallFace[], item: SketchGuideItem) {
  const min = { x: item.centreMm.x - item.sizeMm.x / 2, y: item.centreMm.y - item.sizeMm.y / 2 };
  const max = { x: item.centreMm.x + item.sizeMm.x / 2, y: item.centreMm.y + item.sizeMm.y / 2 };
  const wide = item.sizeMm.x > item.sizeMm.y * 1.25, tall = item.sizeMm.y > item.sizeMm.x * 1.25, shortBack = item.kind === 'bed' || item.kind === 'toilet';
  return faces.flatMap((face) => {
    const horizontal = face.side === 'arriba' || face.side === 'abajo';
    if (item.kind !== 'kitchen' && (wide || tall) && horizontal !== (shortBack ? tall : wide)) return [];
    const [from, to] = horizontal ? [min.x, max.x] : [min.y, max.y];
    if (Math.min(to, face.toMm) - Math.max(from, face.fromMm) <= 0) return [];
    const distance = face.side === 'arriba' ? min.y - face.atMm : face.side === 'abajo' ? face.atMm - max.y
      : face.side === 'izquierda' ? min.x - face.atMm : face.atMm - max.x;
    return distance > -300 && distance <= SKETCH_WALL_REACH_MM ? [{ face, distance: Math.abs(distance), alongMm: Math.round(horizontal ? item.centreMm.x : item.centreMm.y) }] : [];
  }).sort((a, b) => Number(b.face.side === item.back) - Number(a.face.side === item.back) || a.distance - b.distance);
}

const roomOf = (rooms: readonly SketchRoom[], item: SketchGuideItem) => rooms.find((room) => pointInPolygon(item.centreMm, room.boundary));

/** Objetos del boceto que el catálogo todavía no tiene, con su estancia: se le dicen al cliente en la propuesta. */
export function sketchMissing(guide: SketchGuide, rooms: readonly SketchRoom[]): string[] {
  return [...new Set(guide.items.filter((item) => item.missing).map((item) => {
    const room = roomOf(rooms, item)?.name ?? item.roomLabel;
    return `${item.label.charAt(0).toUpperCase()}${item.label.slice(1)}${room ? ` (${room})` : ''}`;
  }))];
}

/**
 * Pieza dibujada con el sitio que el código midió en el boceto: contra una pared (wall, alongMm) o exenta (centro y
 * giro). Una alfombra lleva además su medida dibujada en los ejes del plano.
 */
export interface SketchPlacement {
  label: string; roomId: string; roomName: string; catalogId: string;
  wall?: string; alongMm?: number; cxMm?: number; cyMm?: number; rotation?: number; sizeMm?: { x: number; y: number };
}
export interface SketchKitchen { roomId: string; roomName: string; walls: string[]; appliances: string[] }

/**
 * Lo que colocan los conjuntos junto a su pieza principal (mesilla, mesa de centro, alfombra, taburetes, la lámpara de
 * la mesilla, el televisor): basta con pedirlo; su sitio lo pone su conjunto, o el dibujado si no hay pieza principal.
 */
const companionRule = (entry: FurnitureCatalogEntry | undefined) => entry ? COMPANION_RULES.find((rule) => rule.companion(entry)) : undefined;

/**
 * Giro de la barra exenta: a lo largo de su lado largo y con el frente (el lado de sus taburetes) hacia los taburetes
 * dibujados. Con giro 0 el frente mira abajo; con 90, a la izquierda; con 180, arriba; con 270, a la derecha.
 */
function barRotation(item: SketchGuideItem, turn: number, stools: readonly SketchGuideItem[]): number {
  const stool = [...stools].sort((a, b) => Math.hypot(a.centreMm.x - item.centreMm.x, a.centreMm.y - item.centreMm.y)
    - Math.hypot(b.centreMm.x - item.centreMm.x, b.centreMm.y - item.centreMm.y))[0];
  if (!stool) return turn;
  return turn === 90 ? (stool.centreMm.x < item.centreMm.x ? 90 : 270) : (stool.centreMm.y > item.centreMm.y ? 0 : 180);
}

/** Sitio de cada pieza dibujada y paredes y aparatos de cada cocina, medidos en el boceto. */
export function sketchPlacements(guide: SketchGuide, rooms: readonly SketchRoom[], faces: ReadonlyMap<string, readonly RoomWallFace[]>) {
  const kitchenWalls = new Map<string, Set<string>>(), appliances = new Map<string, Set<string>>();
  const pieces = guide.items.flatMap((item): SketchPlacement[] => {
    const room = roomOf(rooms, item);
    if (!room || item.missing || item.role === 'chairs') return [];
    // El escritorio también va contra la pared, aunque su perfil sea el de una mesa.
    const againstWall = SKETCH_WALL_KINDS.has(item.kind) || item.catalogId === 'habiteka:furniture:escritorio';
    const walls = againstWall ? sketchWalls(faces.get(room.id) ?? [], { ...item, kind: item.kind === 'table' ? 'cabinet' : item.kind }) : [];
    if (item.role === 'kitchen') {
      // Cada tramo de encimera dibujado es un brazo de la cocina; sus aparatos, los que se ven en él.
      if (walls[0]) kitchenWalls.set(room.id, (kitchenWalls.get(room.id) ?? new Set()).add(walls[0].face.id));
      const found = appliances.get(room.id) ?? new Set<string>();
      if (/placa|vitro|fogon/i.test(item.label)) found.add('vitroceramica');
      if (/fregadero/i.test(item.label)) found.add('fregadero');
      if (/horno/i.test(item.label)) found.add('horno');
      if (/lavavajillas/i.test(item.label)) found.add('lavavajillas');
      appliances.set(room.id, found);
      return [];
    }
    if (!item.catalogId) return [];
    const base = { label: item.label, roomId: room.id, roomName: room.name, catalogId: item.catalogId };
    if (walls[0]) return [{ ...base, wall: walls[0].face.id, alongMm: walls[0].alongMm }];
    // Exenta, toma la orientación de su caja: una mesa larga en vertical lleva giro 90; la barra, además, mira a sus taburetes.
    const turn = item.sizeMm.y > item.sizeMm.x * 1.2 ? 90 : item.sizeMm.x > item.sizeMm.y * 1.2 ? 0 : undefined;
    const stools = () => guide.items.filter((other) => isBarStool(getFurnitureCatalogEntry(other.catalogId)) && roomOf(rooms, other)?.id === room.id);
    const rotation = item.kind === 'bar' ? barRotation(item, turn ?? 0, stools()) : item.kind === 'table' ? turn : undefined;
    return [{ ...base, cxMm: item.centreMm.x, cyMm: item.centreMm.y, ...(rotation !== undefined ? { rotation } : {}),
      ...(item.kind === 'rug' ? { sizeMm: item.sizeMm } : {}) }];
  });
  const kitchens: SketchKitchen[] = [...kitchenWalls].map(([roomId, walls]) => ({ roomId, roomName: rooms.find((room) => room.id === roomId)?.name ?? '',
    walls: [...walls].slice(0, 2), appliances: [...(appliances.get(roomId) ?? [])] }));
  return { pieces, kitchens };
}

/** Familia con la que se empareja una pieza de la IA con la dibujada: camas, sofás y sanitarios por uso; lo demás por tipo. */
function family(entry: FurnitureCatalogEntry): string {
  if (/butaca|sillon/.test(entry.id)) return 'butaca';
  if (entry.profile.startsWith('sofa')) return 'sofa';
  if (['bed', 'toilet', 'sink', 'bath', 'shower'].includes(entry.profile)) return entry.profile;
  return entry.kind.replace(/^asset-/, '').replace(/_/g, '-');
}

/**
 * El boceto manda en el sitio: a cada pieza dibujada se le asigna la de la IA de su misma familia en esa estancia, con la
 * pared, el punto y el giro medidos (la IA los copiaba mal o los ignoraba: la mesa del comedor girada, el escritorio en
 * mitad del cuarto). La IA conserva el modelo si es una variante de la dibujada; si no, se usa la dibujada (una cama
 * individual sigue siéndolo). Lo dibujado que la IA no propuso se añade con su pieza del catálogo, y lo que la IA
 * añadió de un tipo que el boceto ya dibuja en otra estancia sobra (salía un segundo zapatero en el lavadero).
 */
export function alignToSketch(raw: readonly unknown[], pieces: readonly SketchPlacement[], roomOfRaw: (value: unknown) => string | undefined): unknown[] {
  const result = [...raw], used = new Set<number>();
  const entryOfRaw = (value: unknown) => {
    const id = (value as { catalogId?: unknown } | null)?.catalogId;
    return typeof id === 'string' ? getFurnitureCatalogEntry(id) : undefined;
  };
  for (const piece of pieces) {
    const drawn = getFurnitureCatalogEntry(piece.catalogId);
    if (!drawn) continue;
    // Lo que va en conjunto se pide aunque la IA lo olvide, y la IA conserva su modelo si ya lo pidió en esa estancia;
    // las demás piezas se emparejan con la de la IA de su misma familia.
    const rule = companionRule(drawn);
    const index = result.findIndex((value, at) => {
      const entry = entryOfRaw(value);
      return !used.has(at) && !!entry && (rule ? rule.companion(entry) : family(entry) === family(drawn)) && roomOfRaw(value) === piece.roomId;
    });
    // La alfombra dibujada se hace a su medida, en los ejes del plano (giro 0).
    const size = piece.sizeMm ? { widthMm: piece.sizeMm.x, depthMm: piece.sizeMm.y, rotation: 0 } : {};
    const placement = piece.wall ? { wall: piece.wall, alongMm: piece.alongMm, cxMm: 0, cyMm: 0, rotation: 0 }
      : { wall: '', alongMm: 0, cxMm: piece.cxMm, cyMm: piece.cyMm, ...(piece.rotation !== undefined ? { rotation: piece.rotation } : {}), ...size };
    if (index < 0) { result.push({ catalogId: drawn.id, rotation: 0, reason: 'Dibujado en el boceto', ...placement }); used.add(result.length - 1); continue; }
    const current = result[index] as Record<string, unknown>, chosen = entryOfRaw(current)!;
    result[index] = { ...current, ...placement, catalogId: rule || chosen.kind === drawn.kind ? chosen.id : drawn.id };
    used.add(index);
  }
  const drawnFamilies = new Set(pieces.flatMap(({ catalogId }) => { const entry = getFurnitureCatalogEntry(catalogId); return entry && !companionRule(entry) ? [family(entry)] : []; }));
  return result.filter((value, at) => {
    const entry = entryOfRaw(value);
    return used.has(at) || !entry || !!companionRule(entry) || !drawnFamilies.has(family(entry));
  });
}

/**
 * El cliente dibujó su distribución en el boceto con el que importó el plano: Amueblar la reproduce. La lectura detallada
 * da cada objeto y su caja; el código mide la pared, el punto y el giro y los impone al leer la respuesta
 * (`alignToSketch`); aquí se le cuenta a la IA para que elija los modelos del estilo y complete lo demás.
 */
export function sketchRule(guide: SketchGuide, rooms: readonly SketchRoom[], faces: ReadonlyMap<string, readonly RoomWallFace[]>): string {
  const { pieces, kitchens } = sketchPlacements(guide, rooms, faces);
  const items = pieces.map(({ label, roomName, catalogId, wall, alongMm, cxMm, cyMm, rotation }) => ({ mueble: label, estancia: roomName, pieza: catalogId,
    ...(wall ? { wall, alongMm } : { cxMm, cyMm, ...(rotation !== undefined ? { rotation } : {}) }) }));
  const missing = sketchMissing(guide, rooms);
  return [`Boceto del cliente (la última imagen adjunta): es SU distribución, la que quiere ver. Está alineado con el plano: su esquina superior izquierda es (0, 0) mm y la inferior derecha (${guide.frameMm.width}, ${guide.frameMm.height}) mm.`,
    `Reprodúcelo. Estos son los muebles dibujados, con la pieza del catálogo que les corresponde y el sitio ya medido en el boceto: ${JSON.stringify(items)}. Incluye cada uno con esa wall y ese alongMm (o ese centro y giro); el sistema impone ese sitio. Puedes cambiar la pieza por una variante suya del catálogo que encaje con el estilo pedido, nunca por otro tipo de mueble. Las sillas de cada mesa, las mesillas y su lámpara, la mesa de centro, la alfombra (a la medida dibujada) y los taburetes de la barra o la isla los pone el sistema junto a su mueble.`,
    kitchens.length ? `La cocina dibujada: ${JSON.stringify(kitchens.map(({ roomId, roomName, walls, appliances }) => ({ roomId, estancia: roomName, walls, aparatosDibujados: appliances })))}. Pon esas walls tal cual en kitchens.walls y en appliances esos aparatos más los que el uso pide (horno, lavavajillas). Si el boceto dibuja la nevera aparte, va en furniture (ya está en la lista) y no pongas frigorifico-columna.` : '',
    missing.length ? `En el boceto hay objetos que el catálogo no tiene: ${missing.join(', ')}. No los sustituyas por otra pieza: el sistema avisa al cliente.` : '',
    'Después completa lo que el boceto no dibuja y el uso pide (lámparas, cortinas, decoración) sin tapar ni mover lo dibujado.'].filter(Boolean).join('\n');
}
