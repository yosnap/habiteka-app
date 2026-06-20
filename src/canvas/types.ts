/**
 * Modelo de estado del canvas (fuente de verdad en React, serializable a JSONB).
 *
 * Es un documento de DOMINIO propio, no el volcado interno de Konva: así el
 * estado no se acopla a los internals del motor de render y conserva los
 * metadatos que el negocio necesita. `schemaVersion` permite migrar el formato
 * sin romper proyectos guardados.
 */

export const CANVAS_SCHEMA_VERSION = 1;

export interface BaseImage {
  url: string;
  width: number;
  height: number;
}

/** Trazo a mano alzada: secuencia de puntos en coordenadas del stage. */
export interface Stroke {
  id: string;
  points: number[];
  color: string;
  width: number;
}

export type StructKind = 'wall' | 'window' | 'door';

/** Objeto estructural editable (muro/ventana/puerta). */
export interface StructObj {
  id: string;
  kind: StructKind;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

/** Producto del marketplace colocado en el canvas. */
export interface ProductRef {
  id: string;
  marketplaceItemId: string;
  x: number;
  y: number;
  /** Elemento de diseño al que se asoció el producto, si aplica. */
  targetRef?: string;
}

/** Selección activa: un objeto por id, o una zona rectangular normalizada (0–1). */
export type CanvasSelection =
  | { type: 'object'; objectId: string }
  | { type: 'zone'; x: number; y: number; width: number; height: number };

export interface CanvasDoc {
  schemaVersion: number;
  baseImage: BaseImage | null;
  strokes: Stroke[];
  objects: StructObj[];
  products: ProductRef[];
  selection: CanvasSelection | null;
}

/** Documento vacío inicial (proyecto recién creado). */
export function emptyCanvasDoc(): CanvasDoc {
  return {
    schemaVersion: CANVAS_SCHEMA_VERSION,
    baseImage: null,
    strokes: [],
    objects: [],
    products: [],
    selection: null,
  };
}
