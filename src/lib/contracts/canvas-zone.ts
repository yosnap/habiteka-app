/**
 * Zona del canvas seleccionada por el usuario, normalizada e independiente de
 * la resolución de la imagen. Producida por la selección en canvas y consumida
 * por el feedback dirigido (inpainting): la máscara delimita qué región se
 * regenera dejando el resto intacto.
 *
 * Las coordenadas se normalizan a 0–1 para que la misma zona sea válida ante
 * cualquier tamaño de render (la imagen puede regenerarse a otra resolución).
 */

/** Caja delimitadora normalizada (0–1) respecto al lienzo. */
export interface NormalizedBBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Punto normalizado (0–1). */
export interface NormalizedPoint {
  x: number;
  y: number;
}

export interface CanvasZone {
  id: string;
  /** Región rectangular. Excluyente con `polygon`. */
  bbox?: NormalizedBBox;
  /** Región poligonal (≥3 puntos). Excluyente con `bbox`. */
  polygon?: NormalizedPoint[];
  /** Referencia a la máscara de inpainting (asset/blob), si ya se rasterizó. */
  maskRef?: string;
}
