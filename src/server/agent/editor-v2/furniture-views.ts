import type { EditorDocument, Furniture, Point } from '@/lib/editor-document/schema';
import { getFurnitureCatalogEntry } from '@/lib/editor-document/furniture-catalog';
import { furnitureSpatial, objectCenter } from '@/lib/editor-document/spatial-properties';
import { pointInPolygon } from '@/lib/editor-document/polygon-tools';

/**
 * Cómo se ve cada mueble del plano desde la cenital y desde los alzados. El catálogo apoya el cabecero de la cama y el
 * respaldo del sofá en su lado local y = 0, así que su giro dice hacia dónde mira: el generador no tiene que adivinarlo
 * de una imagen, algo que no consiguió ni con instrucciones explícitas.
 */
export type Facing = 'frente' | 'espaldas' | 'perfil';

const SOFAS = new Set(['sofa', 'sofa-modular', 'sofa-bed']);
const MAX_ITEMS_PER_ROOM = 6;

export const furnitureProfile = (item: Furniture) => getFurnitureCatalogEntry(item.catalogId)?.profile ?? item.kind;
export const isBed = (item: Furniture) => furnitureProfile(item) === 'bed';
export const isSofa = (item: Furniture) => SOFAS.has(furnitureProfile(item));

export function furnitureHeight(item: Furniture): number {
  return item.heightMm ?? getFurnitureCatalogEntry(item.catalogId)?.heightMm ?? furnitureSpatial(item).heightMm;
}

export function furnitureElevation(item: Furniture): number {
  return item.elevationMm ?? getFurnitureCatalogEntry(item.catalogId)?.elevationMm ?? 0;
}

/** Dirección en planta hacia la que mira el frente del mueble: los pies de la cama, el asiento del sofá. */
export function furnitureFront(item: Furniture): Point {
  const angle = item.rotation * Math.PI / 180;
  return { x: -Math.sin(angle), y: Math.cos(angle) };
}

/** Frente, espalda o perfil respecto de una cámara situada en la dirección `toward` desde el inmueble. */
export function furnitureFacing(item: Furniture, toward: readonly [number, number]): Facing {
  const front = furnitureFront(item), dot = front.x * toward[0] + front.y * toward[1];
  return dot > .5 ? 'frente' : dot < -.5 ? 'espaldas' : 'perfil';
}

function label(item: Furniture): string {
  // «· modelo 3D» distingue variantes en el catálogo; para el generador es ruido.
  return (item.name ?? getFurnitureCatalogEntry(item.catalogId)?.label ?? item.kind).trim().replace(/\s*·\s*modelo 3d$/i, '').toLowerCase();
}

const MAX_PLAN_GROUPS = 10;
const DETAIL_PROFILES = new Set(['appliance', 'screen', 'lamp', 'plant', 'decor', 'rug']);
const SEAT_PROFILES = new Set(['chair', 'stool']);

/** Primero lo que fija la orientación, luego lo grande y fijo (armarios, chimenea, mesas), los asientos y los detalles. */
function importanceTier(item: Furniture): number {
  if (isBed(item) || isSofa(item)) return 0;
  const profile = furnitureProfile(item);
  return DETAIL_PROFILES.has(profile) ? 3 : SEAT_PROFILES.has(profile) ? 2 : 1;
}

/** Muebles de una estancia, con los que tienen cabecero o respaldo primero porque son los que fijan la orientación. */
function roomFurniture(document: EditorDocument, boundary: readonly Point[]): Furniture[] {
  return document.furniture.filter((item) => pointInPolygon(objectCenter(item), boundary))
    .sort((a, b) => Number(isBed(b) || isSofa(b)) - Number(isBed(a) || isSofa(a)));
}

function joinItems(items: string[]): string {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts].slice(0, MAX_ITEMS_PER_ROOM).map(([item, count]) => count > 1 ? `${item} (${count})` : item).join(', ');
}

export const PLAN_SIDE = (back: Point) => Math.abs(back.x) > Math.abs(back.y)
  ? (back.x > 0 ? 'a la derecha' : 'a la izquierda') : (back.y > 0 ? 'abajo' : 'arriba');

/**
 * Muebles de cada estancia vistos en el plano: «Dormitorio: cama doble (cabecero arriba), mesilla (2)». Se ordenan por
 * importancia y no por el orden del documento: antes la cafetera entraba y la chimenea o las sillas se quedaban fuera.
 * Lo apoyado sobre otro mueble o colgado (televisor, lámpara de mesa, campana) es un detalle de ese mueble.
 */
export function planFurnitureLines(document: EditorDocument, rooms: { name: string; boundary?: Point[] }[]): string[] {
  return rooms.flatMap((room) => {
    // Solo se omiten los detalles elevados: un arbusto sobre una jardinera o un mueble sobre una tarima siguen contando.
    const items = room.boundary?.length ? roomFurniture(document, room.boundary)
      .filter((item) => furnitureElevation(item) <= 0 || importanceTier(item) < 3) : [];
    const groups = new Map<string, { tier: number; area: number; count: number }>();
    for (const item of items) {
      const front = furnitureFront(item), side = PLAN_SIDE({ x: -front.x, y: -front.y });
      const text = isBed(item) ? `${label(item)} (cabecero ${side})` : isSofa(item) ? `${label(item)} (respaldo ${side})` : label(item);
      const group = groups.get(text) ?? { tier: importanceTier(item), area: 0, count: 0 };
      group.area += item.widthMm * item.depthMm;
      group.count++;
      groups.set(text, group);
    }
    const described = [...groups].sort(([, a], [, b]) => a.tier - b.tier || b.area - a.area).slice(0, MAX_PLAN_GROUPS)
      .map(([text, group]) => group.count > 1 ? `${text} (${group.count})` : text);
    return described.length ? [`${room.name}: ${described.join(', ')}`] : [];
  });
}

/**
 * Muebles de cada estancia de una sección tal como los ve su cámara. `h` es el eje horizontal del alzado (izquierda a
 * derecha) aplicado a una dirección del plano, para decir a qué lado queda el cabecero de una cama vista de perfil.
 */
export function sectionFurnitureLines(document: EditorDocument, rooms: { name: string; boundary: Point[] }[],
  toward: readonly [number, number], h: (x: number, y: number) => number): string[] {
  return rooms.flatMap((room) => {
    const described = roomFurniture(document, room.boundary).map((item) => {
      if (!isBed(item) && !isSofa(item)) return label(item);
      const facing = furnitureFacing(item, toward), front = furnitureFront(item);
      const back = h(-front.x, -front.y) < 0 ? 'a la izquierda' : 'a la derecha';
      if (isBed(item)) return facing === 'espaldas' ? `${label(item)} vista de espaldas, con la trasera del cabecero en primer plano y los pies hacia el fondo`
        : facing === 'frente' ? `${label(item)} vista de frente, con el cabecero al fondo` : `${label(item)} de perfil, con el cabecero ${back}`;
      return facing === 'espaldas' ? `${label(item)} de espaldas, se ve su respaldo` : facing === 'frente' ? `${label(item)} de frente`
        : `${label(item)} de perfil, con el respaldo ${back}`;
    });
    return described.length ? [`${room.name}: ${joinItems(described)}`] : [];
  });
}
