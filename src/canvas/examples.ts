/**
 * Lienzos de ejemplo: planos ya montados con objetos del catálogo colocados con
 * sentido. Sirven como punto de partida y para mostrar el editor con contenido
 * real (el dev-seed crea proyectos con estos lienzos).
 *
 * Coordenadas en píxeles de stage, alineadas a la rejilla de 20px.
 */
import type { CanvasDoc, StructObj } from './types';
import { CANVAS_SCHEMA_VERSION } from './types';

function obj(
  id: string,
  kind: StructObj['kind'],
  x: number,
  y: number,
  width: number,
  height: number,
  rotation = 0,
): StructObj {
  return { id, kind, x, y, width, height, rotation };
}

function doc(objects: StructObj[]): CanvasDoc {
  return {
    schemaVersion: CANVAS_SCHEMA_VERSION,
    baseImage: null,
    strokes: [],
    objects,
    products: [],
    selection: null,
  };
}

/** Salón rectangular con sofá, mesa, TV y una ventana. */
export const EXAMPLE_SALON: CanvasDoc = doc([
  // Muros del contorno (4 paredes).
  obj('w-top', 'wall', 200, 120, 520, 12),
  obj('w-bottom', 'wall', 200, 480, 520, 12),
  obj('w-left', 'wall', 200, 120, 12, 372),
  obj('w-right', 'wall', 708, 120, 12, 372),
  // Aberturas.
  obj('win-1', 'window', 360, 114, 120, 12),
  obj('door-1', 'door', 300, 474, 80, 12),
  // Mobiliario.
  obj('sofa-1', 'sofa', 260, 360, 200, 90),
  obj('mesa-1', 'mesa', 320, 260, 120, 80),
  obj('tv-1', 'tv', 320, 140, 120, 16),
  obj('lamp-1', 'lampara', 620, 380, 40, 40),
]);

/** Baño con inodoro, lavabo, ducha y bañera. */
export const EXAMPLE_BANO: CanvasDoc = doc([
  obj('w-top', 'wall', 240, 140, 360, 12),
  obj('w-bottom', 'wall', 240, 440, 360, 12),
  obj('w-left', 'wall', 240, 140, 12, 312),
  obj('w-right', 'wall', 588, 140, 12, 312),
  obj('door-1', 'door', 260, 434, 60, 12),
  // Sanitarios.
  obj('inodoro-1', 'inodoro', 280, 360, 40, 60),
  obj('lavabo-1', 'lavabo', 360, 160, 50, 35),
  obj('ducha-1', 'ducha', 500, 160, 80, 80),
  obj('banera-1', 'banera', 280, 200, 160, 70),
]);

export const CANVAS_EXAMPLES: Array<{ title: string; doc: CanvasDoc }> = [
  { title: 'Salón de ejemplo', doc: EXAMPLE_SALON },
  { title: 'Baño de ejemplo', doc: EXAMPLE_BANO },
];
