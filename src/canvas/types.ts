/**
 * Modelo de estado del canvas (fuente de verdad en React, serializable a JSONB).
 *
 * Es un documento de DOMINIO propio, no el volcado interno de Konva: así el
 * estado no se acopla a los internals del motor de render y conserva los
 * metadatos que el negocio necesita. `schemaVersion` permite migrar el formato
 * sin romper proyectos guardados.
 *
 * v2 (F0): añade WallSegment[], version de migración de datos, PlacementRule.
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
  | 'nevera_americana'
  | 'nevera_mini'
  | 'horno'
  | 'isla'
  | 'vitroceramica'
  | 'microondas';
export type FurnitureKind =
  | 'cama'
  | 'sofa'
  | 'sofa_grande'
  | 'butaca'
  | 'mesa'
  | 'silla'
  | 'armario'
  | 'estanteria'
  | 'mesilla';
export type ElectronicsKind = 'tv' | 'ordenador' | 'lampara';
export type DecorKind = 'alfombra' | 'planta' | 'chimenea';
export type LightKind = 'foco';

/** Luces que se montan en el techo (subset de CeilingKind usado en StructKind). */
export type CeilingLightKind = 'ceiling_light' | 'pendant_lamp';

export type StructKind =
  | StructuralKind
  | SanitaryKind
  | KitchenKind
  | FurnitureKind
  | ElectronicsKind
  | DecorKind
  | LightKind
  | CeilingLightKind;

// --- F0: Placement system (kinds futuros; no forman parte de StructKind aún) ---

/** Regla que gobierna cómo se coloca un objeto en 2D y en 3D. */
export type PlacementRule = 'floor' | 'wall-child' | 'wall-surface' | 'ceiling';

/** Kinds que se anclan al techo. */
export type CeilingKind =
  | 'ceiling_light' | 'ceiling_fan' | 'pendant_lamp'
  | 'recessed_light' | 'led_strip' | 'beam' | 'cornice' | 'skylight';

/** Kinds que se anclan en la superficie de un muro. */
export type WallSurfaceKind =
  | 'outlet' | 'switch' | 'thermostat'
  | 'wall_sconce' | 'art_frame' | 'radiator' | 'tv_mount';

/** Kinds que son hijos directos de un muro (aberturas). */
export type WallChildKind = 'door' | 'window';

/** Conjunto de kinds de techo, para lookup O(1) en placementOf. */
export const CEILING_KINDS = new Set<CeilingKind>([
  'ceiling_light', 'ceiling_fan', 'pendant_lamp', 'recessed_light',
  'led_strip', 'beam', 'cornice', 'skylight',
]);

/** Conjunto de kinds de superficie de muro, para lookup O(1) en placementOf. */
export const WALL_SURFACE_KINDS = new Set<WallSurfaceKind>([
  'outlet', 'switch', 'thermostat', 'wall_sconce', 'art_frame', 'radiator', 'tv_mount',
]);

/**
 * Dado el kind de un objeto, devuelve su placement canónico.
 * Acepta tanto los kinds actuales (Spanish) como los futuros (English).
 * - 'wall' → 'wall' (muro estructural, no placement de mueble)
 * - 'door' | 'window' → 'wall-child'
 * - CeilingKind → 'ceiling'
 * - WallSurfaceKind → 'wall-surface'
 * - todo lo demás → 'floor'
 */
export function placementOf(
  kind: StructKind | CeilingKind | WallSurfaceKind,
): PlacementRule | 'wall' {
  if (kind === 'wall') return 'wall';
  if (kind === 'door' || kind === 'window') return 'wall-child';
  if (CEILING_KINDS.has(kind as CeilingKind)) return 'ceiling';
  if (WALL_SURFACE_KINDS.has(kind as WallSurfaceKind)) return 'wall-surface';
  return 'floor';
}

// --- F0: Modelo de muros como segmentos (WallSegment) ---

/** Punto en coordenadas 2D del stage (píxeles). */
export interface Point2D {
  x: number;
  y: number;
}

/**
 * Muro como segmento entre dos puntos. Sustituye al StructObj {kind:'wall'} en
 * el modelo v2. Permite detectar topología (ciclos → rooms) sin ambigüedades.
 */
export interface WallSegment {
  id: string;
  p1: Point2D;
  p2: Point2D;
  /** Grosor en px del stage (equivale a ~15 cm por defecto). */
  thicknessPx: number;
  /** Altura en metros; ausente → hereda ceilingHeightM del doc. */
  heightM?: number;
  color?: string;
  material?: string;
  meta?: Record<string, unknown>;
}

/**
 * Sala detectada automáticamente a partir de un grafo de WallSegments.
 * Es DERIVADA (no se persiste en BD), se recalcula al cargar el doc.
 */
export interface DetectedRoom {
  id: string;
  /** IDs de segmentos que forman el contorno. */
  segmentIds: string[];
  /** Polígono ordenado — derivado de los segmentos, no manual. */
  vertices: Point2D[];
  /** Área en metros cuadrados. */
  areaM2: number;
  name?: string;
}

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
  /** Referencia al CatalogItem ('builtin:sofa', 'custom:uuid'). Null = legacy. */
  catalogId?: string;
  /** Para aberturas wall-child: id del WallSegment padre. */
  parentId?: string;
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
  /**
   * Altura de la BASE del mueble sobre el suelo en metros (3ª dimensión, elevación).
   * 0 = apoyado en el suelo. Permite colocar elementos a distinta altura (ej: microondas
   * sobre encimera). Ausente ⇒ se usa el valor por defecto del kind (o 0 si no lo tiene).
   */
  elevationM?: number;
  /** Datos específicos por kind: color de pintura, potencia de luz, etc. */
  meta?: Record<string, unknown>;
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
  /**
   * Versión de migración de datos (independiente de schemaVersion).
   * 1 = muros como StructObj rectangulares (legacy).
   * 2 = muros como WallSegment[] en `walls` (F0+).
   * Ausente ⇒ se trata como v1.
   */
  version?: number;
  baseImage: BaseImage | null;
  strokes: Stroke[];
  /**
   * Muros estructurales como segmentos (modelo v2).
   * En docs v1 este campo está ausente; los muros viven en `objects` con kind:'wall'.
   */
  walls?: WallSegment[];
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
  /**
   * Salas detectadas automáticamente (derivadas, no se persisten en BD).
   * Se recalculan al cargar el doc cuando `walls` está presente.
   */
  rooms?: DetectedRoom[];
}

/** Documento vacío inicial (proyecto recién creado). */
export function emptyCanvasDoc(): CanvasDoc {
  return {
    schemaVersion: CANVAS_SCHEMA_VERSION,
    version: 2,
    baseImage: null,
    strokes: [],
    walls: [],
    objects: [],
    products: [],
    selection: null,
  };
}
