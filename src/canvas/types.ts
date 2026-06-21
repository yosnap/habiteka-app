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
  /** Opacidad del fondo (0–1); permite atenuarlo para que no tape lo dibujado. */
  opacity?: number;
}

/** Trazo a mano alzada: secuencia de puntos en coordenadas del stage. */
export interface Stroke {
  id: string;
  points: number[];
  color: string;
  width: number;
}

// Objetos colocables en el plano, por categoría. Comparten la misma geometría
// editable (posición/tamaño/rotación), así que el mismo `StructObj`, store y
// Transformer sirven para todos; solo cambia cómo se dibuja cada uno.
export type StructuralKind = 'wall' | 'window' | 'door';
export type SanitaryKind = 'inodoro' | 'lavabo' | 'ducha' | 'banera' | 'bidet';
export type KitchenKind = 'fregadero' | 'encimera' | 'nevera' | 'horno' | 'isla';
export type FurnitureKind =
  | 'cama'
  | 'sofa'
  | 'mesa'
  | 'silla'
  | 'armario'
  | 'estanteria'
  | 'mesilla';
export type ElectronicsKind = 'tv' | 'ordenador' | 'lampara';

export type StructKind =
  | StructuralKind
  | SanitaryKind
  | KitchenKind
  | FurnitureKind
  | ElectronicsKind;

/** Objeto colocable y editable del plano (estructura o mobiliario). */
export interface StructObj {
  id: string;
  kind: StructKind;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  /** Volteo horizontal (espejo), p. ej. una puerta que abre al otro lado. */
  flipX?: boolean;
  /** Id de grupo: los objetos con el mismo `groupId` se seleccionan/mueven juntos. */
  groupId?: string;
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

/**
 * Escala arquitectónica del plano: vincula los píxeles del stage con medidas
 * reales. `pxPerMeter` es la fuente de verdad de la conversión; el `ratio`
 * arquitectónico (50 ⇒ "1:50") es metadato presentacional opcional. Campo
 * aditivo y opcional del doc: un plano sin `scale` trabaja en píxeles abstractos
 * (no se sube `CANVAS_SCHEMA_VERSION`).
 */
export interface CanvasScale {
  /** Píxeles de stage equivalentes a 1 metro real. Debe ser positivo y finito. */
  pxPerMeter: number;
  /** Ratio arquitectónico presentacional (50 = "1:50"). No se usa para convertir. */
  ratio?: number;
}

/** Selección activa: un objeto por id, o una zona rectangular normalizada (0–1). */
export type CanvasSelection =
  | { type: 'object'; objectIds: string[] }
  | { type: 'zone'; x: number; y: number; width: number; height: number };

export interface CanvasDoc {
  schemaVersion: number;
  baseImage: BaseImage | null;
  strokes: Stroke[];
  objects: StructObj[];
  products: ProductRef[];
  selection: CanvasSelection | null;
  /** Escala arquitectónica. Ausente ⇒ el plano trabaja en píxeles abstractos. */
  scale?: CanvasScale;
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
