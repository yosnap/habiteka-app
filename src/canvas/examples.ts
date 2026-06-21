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

function doc(objects: StructObj[], scale?: CanvasDoc['scale']): CanvasDoc {
  return {
    schemaVersion: CANVAS_SCHEMA_VERSION,
    baseImage: null,
    strokes: [],
    objects,
    products: [],
    selection: null,
    ...(scale ? { scale } : {}),
  };
}

/**
 * Salón rectangular con una disposición COHERENTE (importa para los renders y
 * los spikes de calidad): la TV se ancla a la pared del fondo y el sofá la mira
 * de frente desde la mitad de la sala, con la mesa de centro entre ambos. La
 * puerta va en la pared lateral izquierda (entrada despejada, no detrás de un
 * mueble) y la ventana en la pared del fondo, a un lado de la TV. La lámpara
 * ocupa una esquina libre. Así "frente a la TV", "junto a la ventana" y "entrada
 * por la izquierda" se corresponden con la realidad del plano.
 */
export const EXAMPLE_SALON: CanvasDoc = doc([
  // Muros del contorno (4 paredes). Sala de 520×360 px.
  obj('w-top', 'wall', 200, 120, 520, 12),
  obj('w-bottom', 'wall', 200, 480, 520, 12),
  obj('w-left', 'wall', 200, 120, 12, 372),
  obj('w-right', 'wall', 708, 120, 12, 372),
  // Aberturas: puerta en la pared izquierda; ventana en la pared del fondo (derecha).
  obj('door-1', 'door', 194, 300, 12, 90),
  obj('win-1', 'window', 540, 114, 140, 12),
  // Mobiliario: TV en el fondo (izquierda), sofá enfrentado mirando al fondo,
  // mesa de centro entre ambos, lámpara en la esquina derecha libre.
  obj('tv-1', 'tv', 300, 134, 140, 16),
  obj('mesa-1', 'mesa', 320, 250, 120, 70),
  obj('sofa-1', 'sofa', 300, 370, 200, 80),
  obj('lamp-1', 'lampara', 650, 410, 40, 40),
  // Escala: 100 px = 1 m ⇒ sala 5,2×3,6 m, puerta 0,9 m, ventana 1,4 m, sofá 2 m.
], { pxPerMeter: 100, ratio: 50 });

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
