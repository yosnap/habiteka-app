/**
 * Opciones de mobiliario por tipo de sala para el asistente de diseño (paso "qué muebles").
 * Lógica PURA de dominio: el wizard (UI) presenta estas opciones como casillas/cantidades y el
 * auto-amueblado (`autofurnish`) coloca solo lo seleccionado. Cada opción lleva su pared de
 * anclaje (`anchor`) y un `order` para repartir en fila sin solapes (p. ej. cama centrada con
 * las mesillas a los lados). El `anchor` vive AQUÍ, no en la selección del usuario.
 */
import type { StructKind } from '../types';
import { CATALOG_BY_KIND } from '../catalog';
import type { RoomType } from './room-types';

/**
 * Ancla de un mueble: una pared (Konva, Y-abajo) o el centro de la sala.
 * 'N' = pared superior (y menor), 'S' = inferior, 'O' = izquierda, 'E' = derecha.
 */
export type WallAnchor = 'N' | 'S' | 'E' | 'O' | 'center';

export interface RoomFurnitureOption {
  kind: StructKind;
  /** Etiqueta visible (del catálogo si existe, o el propio kind). */
  label: string;
  /** Pared de anclaje (o 'center' para piezas centrales como mesa/isla/alfombra). */
  anchor: WallAnchor;
  /** Marcado por defecto en el wizard. */
  default: boolean;
  /** Permite elegir cantidad (sillas, mesillas). */
  repeatable?: boolean;
  /** Cantidad máxima si es repetible. */
  maxQty?: number;
  /** Cantidad inicial si es repetible y `default`. */
  defaultQty?: number;
  /** Orden dentro de su fila (menor = más al centro). Las piezas se centran por este orden. */
  order: number;
}

/** Cantidad seleccionada por kind (0 o ausente = no colocar). */
export type FurnitureSelection = Record<string, number>;

/** Etiqueta del catálogo para un kind (o el kind capitalizado como fallback). */
function labelOf(kind: StructKind): string {
  return CATALOG_BY_KIND[kind]?.label ?? kind;
}

function opt(
  kind: StructKind,
  anchor: WallAnchor,
  isDefault: boolean,
  order: number,
  extra?: Partial<RoomFurnitureOption>,
): RoomFurnitureOption {
  return { kind, label: labelOf(kind), anchor, default: isDefault, order, ...extra };
}

/**
 * Muebles ofrecidos por tipo de sala. El `order` controla el reparto en fila (las piezas con
 * menor `order` quedan más al centro). Los opcionales van desmarcados (`default: false`).
 */
export const ROOM_FURNITURE: Record<RoomType, RoomFurnitureOption[]> = {
  salon: [
    opt('sofa', 'S', true, 0),
    opt('tv', 'N', true, 0),
    opt('mesa', 'center', true, 0),
    opt('silla', 'center', true, 1, { repeatable: true, maxQty: 6, defaultQty: 2 }),
    opt('lampara', 'E', false, 0),
    opt('alfombra', 'center', false, 2),
    opt('planta', 'O', false, 0),
    opt('chimenea', 'N', false, 1),
  ],
  dormitorio: [
    opt('cama', 'N', true, 0),
    opt('mesilla', 'N', true, 1, { repeatable: true, maxQty: 2, defaultQty: 2 }),
    opt('armario', 'S', true, 0),
    opt('lampara', 'E', false, 0),
  ],
  cocina: [
    opt('fregadero', 'N', true, 0),
    opt('encimera', 'N', true, 1),
    opt('horno', 'N', true, 2),
    opt('nevera', 'O', true, 0),
    opt('isla', 'center', false, 0),
  ],
  bano: [
    opt('inodoro', 'O', true, 0),
    opt('lavabo', 'N', true, 0),
    opt('ducha', 'E', true, 0),
    opt('banera', 'S', false, 0),
    opt('bidet', 'O', false, 1),
  ],
};

/**
 * Selección por defecto de un tipo de sala: los muebles `default`, con su `defaultQty` si son
 * repetibles (o 1 si no). Base del paso del wizard y comportamiento de `autofurnish` sin selección.
 */
export function defaultSelection(roomType: RoomType): FurnitureSelection {
  const selection: FurnitureSelection = {};
  for (const o of ROOM_FURNITURE[roomType] ?? []) {
    if (!o.default) continue;
    selection[o.kind] = o.repeatable ? (o.defaultQty ?? 1) : 1;
  }
  return selection;
}

/** Busca la opción de un kind en un tipo de sala (para resolver su anchor/order). */
export function findOption(roomType: RoomType, kind: StructKind): RoomFurnitureOption | undefined {
  return (ROOM_FURNITURE[roomType] ?? []).find((o) => o.kind === kind);
}
