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
export type KitchenKind =
  | 'fregadero'
  | 'encimera'
  | 'nevera'
  | 'horno'
  | 'isla'
  | 'vitroceramica'
  | 'microondas';
export type FurnitureKind =
  | 'cama'
  | 'sofa'
  | 'mesa'
  | 'silla'
  | 'armario'
  | 'estanteria'
  | 'mesilla';
export type ElectronicsKind = 'tv' | 'ordenador' | 'lampara';
export type DecorKind = 'alfombra' | 'planta' | 'chimenea';
export type LightKind = 'foco';

export type StructKind =
  | StructuralKind
  | SanitaryKind
  | KitchenKind
  | FurnitureKind
  | ElectronicsKind
  | DecorKind
  | LightKind;

/**
 * Atributos de iluminación de una luz de primera clase (F-LUZ). Solo los objetos
 * de tipo luz los llevan (`StructObj.light`); el render y un panel de UI los leen,
 * el resto del pipeline ignora el campo. La intensidad es 0–100.
 */
export interface LightProps {
  /** Color de la luz en hex (#rrggbb). */
  color: string;
  /** Intensidad relativa, 0–100. */
  intensidad: number;
}

/** Objeto colocable y editable del plano (estructura o mobiliario). */
export interface StructObj {
  id: string;
  kind: StructKind;
  x: number;
  /**
   * Geometría EN PLANTA (vista cenital). `width` y `height` son las dos
   * dimensiones vistas desde arriba: `width` = largo, `height` = fondo (en un
   * muro, su GROSOR). NO son la altura vertical: esa es la 3ª dimensión `heightM`.
   */
  y: number;
  width: number;
  height: number;
  rotation: number;
  /** Volteo horizontal (espejo), p. ej. una puerta que abre al otro lado. */
  flipX?: boolean;
  /** Id de grupo: los objetos con el mismo `groupId` se seleccionan/mueven juntos. */
  groupId?: string;
  /** Atributos de iluminación; presente solo en objetos de tipo luz (F-LUZ). */
  light?: LightProps;
  /**
   * Altura vertical REAL en metros (la 3ª dimensión, que el plano 2D no captura).
   * Opcional: si falta, se asume la altura típica del elemento (muros → altura de
   * techo del plano; muebles → su altura habitual). Da contexto 3D al render.
   */
  heightM?: number;
  /**
   * Color del material en hex (#rrggbb), p. ej. la pintura de una pared elegida en el 3D.
   * Opcional y aditivo: si falta, el render usa el color por defecto del elemento. Hoy lo
   * aplica el render 3D a los muros; el 2D puede ignorarlo.
   */
  color?: string;
  /**
   * Ocultar el elemento en la vista 3D sin borrarlo del doc (toggle de pared, F3 editor).
   * Aditivo: docs sin el campo se comportan igual (elemento visible).
   */
  hidden?: boolean;
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

/**
 * Vértice del contorno interior del suelo, en píxeles de plano. Una lista cerrada de
 * estos describe el polígono del suelo para formas no rectangulares (L/U/T): el render
 * 3D lo extruye/teselita en vez de asumir un rectángulo. Mismo sistema que los objetos
 * (origen arriba-izquierda, Y hacia abajo).
 */
export interface FloorVertex {
  x: number;
  y: number;
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
  /**
   * Altura de techo del plano en metros (3ª dimensión global). Da contexto 3D al
   * render y es la altura por defecto de los muros sin `heightM` propio. Ausente ⇒
   * se asume una altura estándar (~2,5 m) al describir el espacio.
   */
  ceilingHeightM?: number;
  /**
   * Contorno interior del suelo en píxeles (polígono cerrado, recorrido horario). Lo
   * genera el wizard para formas no rectangulares (L/U/T) y permite al render 3D dibujar
   * un suelo poligonal exacto en vez del bounding box de los muros. Ausente ⇒ el suelo se
   * deriva del bounding box de los muros (comportamiento rectangular previo, sin cambios).
   */
  floorOutline?: FloorVertex[];
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
