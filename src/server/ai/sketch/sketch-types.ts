/**
 * Tipos del boceto crudo tal y como los devuelve el modelo de visión.
 *
 * Coordenadas NORMALIZADAS 0–1 respecto a la imagen (mismo convenio que la
 * detección de layout). Los nombres de campo coinciden con el wire format del
 * schema JSON para que el parseo sea directo. La conversión a unidades métricas
 * y a `Plano2dPayload` es responsabilidad de `normalize-geometry.ts`.
 */
import type { ApertureKind } from '@/lib/contracts';

export interface SketchPoint {
  x: number;
  y: number;
}

/** Muro como segmento en coordenadas de imagen (0–1). */
export interface SketchWall {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /**
   * Grosor MEDIDO del trazo, como fracción del lado de la imagen perpendicular
   * al muro (solo lo aporta la detección de píxeles). Permite distinguir la
   * fachada gruesa de los tabiques; ausente = grosor por defecto.
   */
  thickness?: number;
}

/** Abertura anclada a un muro por índice. */
export interface SketchAperture {
  tipo: ApertureKind;
  /** Índice del muro en `muros` al que pertenece. */
  muro: number;
  /** Posición del centro a lo largo del muro (0–1 desde su primer punto). */
  posicion: number;
  /** Ancho como fracción de la longitud del muro (0–1). */
  anchoSobreMuro?: number;
  /** Lado al que bate la hoja respecto al muro crudo orientado (x1,y1) → (x2,y2). */
  swing?: 'left' | 'right';
  /** Bisagra en el inicio o final del hueco respecto al muro crudo orientado. */
  hinge?: 'left' | 'right';
  /** Arco de barrido visible en la imagen; distingue puerta de hueco sin hoja. */
  arcVisible?: boolean;
  /** Tres puntos observados del símbolo: bisagra, otro extremo del vano y un punto del arco. */
  arcGeometry?: { hinge: SketchPoint; openingEnd: SketchPoint; arcPoint: SketchPoint };
}

/** Habitación etiquetada con su contorno aproximado. */
export interface SketchRoom {
  nombre: string;
  poligono: SketchPoint[];
  /** Espacio exterior o semiabierto (terraza, patio, porche, loggia). */
  exterior?: boolean;
  /** Medidas ESCRITAS dentro de la estancia (p. ej. "3,00 x 4,00 m"), en metros. */
  anchoMetros?: number;
  altoMetros?: number;
  /** Superficie escrita (p. ej. "10,5 m²"). */
  areaM2?: number;
}

/** Rótulo de cota leído en el plano, con su posición. */
export interface SketchDimension {
  texto: string;
  /** Valores numéricos en metros que contiene el rótulo (1 para una cota lineal, 2 para "a x b"). */
  valoresMetros: number[];
  /** `general`: línea de cota del contorno; `estancia`: medida escrita dentro de una estancia. */
  tipo: 'general' | 'estancia';
  /** Punto del rótulo en coordenadas de imagen. */
  ancla: SketchPoint;
}

/** Tipos de mobiliario reconocibles en planta (vocabulario cerrado del catálogo). */
export const SKETCH_FURNITURE_KINDS = [
  'sofa', 'bed', 'chair', 'table', 'cabinet', 'shelf', 'kitchen', 'sink', 'toilet',
  'bath', 'shower', 'lamp', 'plant', 'rug', 'appliance', 'bench', 'car',
] as const;
export type SketchFurnitureKind = (typeof SKETCH_FURNITURE_KINDS)[number];

/** Mueble o aparato dibujado, por su caja en coordenadas de imagen. */
export interface SketchFurniture {
  tipo: SketchFurnitureKind;
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
  /** Giro del mueble en grados (0 = como se lee la imagen), múltiplo de 90 tras validar. */
  rotacionDeg: number;
  /** Rótulo del plano si lo tiene (p. ej. "Isla"). */
  etiqueta?: string;
}

/** Salida validada de la extracción de un boceto. */
export interface RawSketch {
  /** Rótulos de cota leídos (planos dibujados/CAD). */
  cotas?: SketchDimension[];
  /** Mobiliario dibujado (planos dibujados/CAD). */
  mobiliario?: SketchFurniture[];
  /** Ancho real estimado del plano dibujado, en metros (si el boceto lo indica). */
  anchoMetros?: number;
  /** Alto real estimado, en metros. */
  altoMetros?: number;
  /**
   * True SOLO si la escala sale de cotas o medidas ESCRITAS en el boceto.
   * Con false/ausente la escala es una conjetura: las cotas derivadas no deben
   * presentarse al usuario como medidas reales.
   */
  escalaFiable?: boolean;
  muros: SketchWall[];
  aberturas: SketchAperture[];
  habitaciones: SketchRoom[];
}
