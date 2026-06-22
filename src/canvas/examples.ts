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
// Escala del ejemplo: 100 px = 1 m (ratio 1:100 coherente con pxPerMeter). Todas
// las medidas de abajo son px = cm·… a esta escala (p. ej. 90 px = 90 cm). Muro de
// 15 cm de grosor = 15 px; puerta de 90 cm de paso = 90 px; sofá de 2 m = 200 px.
export const EXAMPLE_SALON: CanvasDoc = doc(
  [
    // Contorno: sala interior de 5,2 × 3,6 m. Muros de 15 cm de grosor (15 px).
    obj('w-top', 'wall', 200, 120, 520, 15),
    obj('w-bottom', 'wall', 200, 465, 520, 15),
    obj('w-left', 'wall', 200, 120, 15, 360),
    obj('w-right', 'wall', 705, 120, 15, 360),
    // Aberturas integradas en el hueco de su pared, SOBRESALIENDO un poco hacia el
    // interior para que sean visibles y seleccionables (no quedar tapadas por el
    // muro). Puerta de 90 cm en la pared izquierda (vertical: 18 px de hoja × 90
    // px de paso); ventana de 1,4 m en la pared del fondo.
    obj('door-1', 'door', 209, 290, 18, 90),
    obj('win-1', 'window', 540, 111, 140, 18),
    // Mobiliario con medidas reales (px = cm): TV 1,4 m al fondo; mesa 1,2×0,7 m;
    // sofá 2×0,9 m enfrentado; lámpara 0,4 m en una esquina.
    obj('tv-1', 'tv', 300, 138, 140, 12),
    obj('mesa-1', 'mesa', 330, 250, 120, 70),
    obj('sofa-1', 'sofa', 300, 370, 200, 90),
    obj('lamp-1', 'lampara', 650, 410, 40, 40),
  ],
  { pxPerMeter: 100, ratio: 100 },
);

/** Baño con inodoro, lavabo, ducha y bañera. Misma escala que el salón (100 px = 1 m). */
export const EXAMPLE_BANO: CanvasDoc = doc(
  [
    // Contorno: baño de 3,6 × 3,1 m, muros de 15 cm.
    obj('w-top', 'wall', 240, 140, 360, 15),
    obj('w-bottom', 'wall', 240, 435, 360, 15),
    obj('w-left', 'wall', 240, 140, 15, 310),
    obj('w-right', 'wall', 585, 140, 15, 310),
    // Puerta de 70 cm (baño) integrada en la pared inferior, sobresaliendo hacia
    // dentro para que sea visible/seleccionable (no tapada por el muro).
    obj('door-1', 'door', 270, 426, 70, 18),
    // Sanitarios con medidas reales (px = cm): inodoro 40×60, lavabo 60×45,
    // ducha 90×90, bañera 1,7×0,75 m.
    obj('inodoro-1', 'inodoro', 280, 360, 40, 60),
    obj('lavabo-1', 'lavabo', 380, 160, 60, 45),
    obj('ducha-1', 'ducha', 480, 160, 90, 90),
    obj('banera-1', 'banera', 270, 250, 170, 75),
  ],
  { pxPerMeter: 100, ratio: 100 },
);

export const CANVAS_EXAMPLES: Array<{ title: string; doc: CanvasDoc }> = [
  { title: 'Salón de ejemplo', doc: EXAMPLE_SALON },
  { title: 'Baño de ejemplo', doc: EXAMPLE_BANO },
];
