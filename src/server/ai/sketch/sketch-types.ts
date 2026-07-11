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
}

/** Habitación etiquetada con su contorno aproximado. */
export interface SketchRoom {
  nombre: string;
  poligono: SketchPoint[];
}

/** Salida validada de la extracción de un boceto. */
export interface RawSketch {
  /** Ancho real estimado del plano dibujado, en metros (si el boceto lo indica). */
  anchoMetros?: number;
  /** Alto real estimado, en metros. */
  altoMetros?: number;
  muros: SketchWall[];
  aberturas: SketchAperture[];
  habitaciones: SketchRoom[];
}
