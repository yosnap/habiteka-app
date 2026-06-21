/**
 * Cálculo de la vista (zoom + desplazamiento) para encuadrar el contenido del
 * plano en el área visible. Lógica PURA y testeable, sin Konva ni React.
 *
 * La "vista" del stage es { scale, x, y }: una escala uniforme y un desplazamiento
 * en píxeles de pantalla. `fitToContent` calcula la vista que centra el bounding
 * box de los objetos dentro del viewport con un margen, acotando el zoom.
 */
import type { StructObj } from './types';

export interface CanvasView {
  scale: number;
  x: number;
  y: number;
}

interface FitOptions {
  /** Límites de zoom (deben coincidir con los del stage). */
  minScale: number;
  maxScale: number;
  /** Margen alrededor del contenido, en fracción del viewport (0–0.5). */
  marginRatio?: number;
}

/**
 * Vista que encuadra los objetos en un viewport de `width`×`height`. Si no hay
 * objetos, devuelve la vista identidad (100 %, sin desplazamiento).
 */
export function fitToContent(
  objects: StructObj[],
  width: number,
  height: number,
  opts: FitOptions,
): CanvasView {
  if (objects.length === 0 || width <= 0 || height <= 0) {
    return { scale: 1, x: 0, y: 0 };
  }
  const minX = Math.min(...objects.map((o) => o.x));
  const minY = Math.min(...objects.map((o) => o.y));
  const maxX = Math.max(...objects.map((o) => o.x + o.width));
  const maxY = Math.max(...objects.map((o) => o.y + o.height));
  const contentW = maxX - minX || 1;
  const contentH = maxY - minY || 1;

  const margin = opts.marginRatio ?? 0.1;
  const usableW = width * (1 - margin * 2);
  const usableH = height * (1 - margin * 2);

  // Escala que hace caber el contenido en el área usable, acotada a los límites.
  const rawScale = Math.min(usableW / contentW, usableH / contentH);
  const scale = Math.min(opts.maxScale, Math.max(opts.minScale, rawScale));

  // Centro del contenido (en mundo) al centro del viewport (en pantalla).
  const contentCx = minX + contentW / 2;
  const contentCy = minY + contentH / 2;
  return {
    scale,
    x: width / 2 - contentCx * scale,
    y: height / 2 - contentCy * scale,
  };
}
