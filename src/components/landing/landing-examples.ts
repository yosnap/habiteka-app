/**
 * Fotos y proyectos de muestra de la home. Las fotos son celdas de los atlas
 * fotográficos del catálogo; los proyectos son EJEMPLOS ILUSTRATIVOS inventados
 * (autorizados para la home) y siempre se muestran rotulados como tales.
 */

export interface AtlasSpec {
  src: string;
  /** Tamaño del fichero en píxeles: fija la proporción de cada celda para no deformarla. */
  width: number;
  height: number;
  columns: number;
  rows: number;
}

export const ROOMS_ATLAS: AtlasSpec = { src: '/images/catalog/rooms-v1.webp', width: 1536, height: 1024, columns: 3, rows: 3 };
export const EXTRA_ATLAS: AtlasSpec = { src: '/images/catalog/rooms-extra-v1.webp', width: 1024, height: 682, columns: 2, rows: 2 };
export const CATEGORIES_ATLAS: AtlasSpec = { src: '/images/catalog/categories-v1.webp', width: 1086, height: 1448, columns: 3, rows: 4 };

export interface AtlasPhotoRef {
  atlas: AtlasSpec;
  cell: number;
  alt: string;
}

const room = (cell: number, alt: string): AtlasPhotoRef => ({ atlas: ROOMS_ATLAS, cell, alt });
const extra = (cell: number, alt: string): AtlasPhotoRef => ({ atlas: EXTRA_ATLAS, cell, alt });

export const PHOTOS = {
  salon: room(0, 'Salón luminoso con sofá blanco, mesa redonda de madera y olivo'),
  dormitorio: room(1, 'Dormitorio en lino blanco y verde salvia con banco de madera'),
  cocina: room(2, 'Cocina de madera con isla de piedra y taburetes de enea'),
  bano: room(3, 'Baño de piedra clara con bañera exenta y lavabo sobre encimera'),
  comedor: room(4, 'Comedor con mesa de roble, sillas de enea y lámparas colgantes'),
  despacho: room(5, 'Despacho con mesa de madera, silla ergonómica y estantería'),
  exterior: room(6, 'Porche exterior con sofá de obra bajo una pérgola y vistas'),
  iluminacion: room(7, 'Rincón con lámparas de techo y de pie de tonos cálidos'),
  decoracion: room(8, 'Rincón decorado con olivo, jarrones de cerámica y banco'),
  infantil: extra(0, 'Dormitorio infantil con tipi y estantería de juguetes'),
  recibidor: extra(1, 'Recibidor con banco zapatero, espejo redondo y puerta verde'),
  lavadero: extra(2, 'Lavadero con lavadora, secadora y estantes de madera'),
  garaje: extra(3, 'Garaje con estanterías metálicas y una bicicleta'),
} satisfies Record<string, AtlasPhotoRef>;

export type PhotoKey = keyof typeof PHOTOS;

/** Marquesina de estancias (dos filas en sentidos opuestos). */
export const MARQUEE_ROWS: { key: PhotoKey; label: string }[][] = [
  [
    { key: 'salon', label: 'Salón' }, { key: 'cocina', label: 'Cocina' }, { key: 'dormitorio', label: 'Dormitorio' },
    { key: 'exterior', label: 'Exterior' }, { key: 'bano', label: 'Baño' }, { key: 'infantil', label: 'Infantil' },
    { key: 'iluminacion', label: 'Iluminación' },
  ],
  [
    { key: 'comedor', label: 'Comedor' }, { key: 'recibidor', label: 'Recibidor' }, { key: 'despacho', label: 'Despacho' },
    { key: 'decoracion', label: 'Decoración' }, { key: 'lavadero', label: 'Lavadero' }, { key: 'garaje', label: 'Garaje' },
  ],
];

/** Estancias del plano interactivo (piso de ejemplo de 85 m²). Coordenadas en el viewBox 0 0 800 520. */
export interface DemoRoom {
  id: string;
  name: string;
  photo: PhotoKey;
  rect: { x: number; y: number; w: number; h: number };
  size: string;
}

export const DEMO_ROOMS: DemoRoom[] = [
  { id: 'salon', name: 'Salón', photo: 'salon', rect: { x: 20, y: 20, w: 230, h: 260 }, size: '4,60 × 5,20 m' },
  { id: 'comedor', name: 'Comedor', photo: 'comedor', rect: { x: 250, y: 20, w: 170, h: 260 }, size: '3,40 × 5,20 m' },
  { id: 'cocina', name: 'Cocina', photo: 'cocina', rect: { x: 420, y: 20, w: 200, h: 180 }, size: '4,00 × 3,60 m' },
  { id: 'despacho', name: 'Despacho', photo: 'despacho', rect: { x: 620, y: 20, w: 160, h: 180 }, size: '3,20 × 3,60 m' },
  { id: 'recibidor', name: 'Recibidor', photo: 'recibidor', rect: { x: 420, y: 200, w: 360, h: 80 }, size: '7,20 × 1,60 m' },
  { id: 'dormitorio', name: 'Dormitorio', photo: 'dormitorio', rect: { x: 20, y: 280, w: 280, h: 220 }, size: '5,60 × 4,40 m' },
  { id: 'bano', name: 'Baño', photo: 'bano', rect: { x: 300, y: 280, w: 140, h: 220 }, size: '2,80 × 4,40 m' },
  { id: 'infantil', name: 'Infantil', photo: 'infantil', rect: { x: 440, y: 280, w: 200, h: 220 }, size: '4,00 × 4,40 m' },
  { id: 'lavadero', name: 'Lavadero', photo: 'lavadero', rect: { x: 640, y: 280, w: 140, h: 220 }, size: '2,80 × 4,40 m' },
];

export interface SampleProject {
  title: string;
  place: string;
  summary: string;
  cover: PhotoKey;
  alternate: PhotoKey;
  deliverables: string[];
}

export const SAMPLE_PROJECTS: SampleProject[] = [
  { title: 'Piso de 85 m²', place: 'Valencia', summary: 'Reforma integral con salón y comedor abiertos.', cover: 'salon', alternate: 'comedor', deliverables: ['Plano con cotas', 'Diseños por estancia', 'Montaje 9:16'] },
  { title: 'Casa de campo', place: 'Teruel', summary: 'Tejado a dos aguas, porche y parcela orientada al sol.', cover: 'exterior', alternate: 'decoracion', deliverables: ['Parcela sobre ortofoto', 'Tejado con lucernario', 'Paseo de 60 s'] },
  { title: 'Ático con terraza', place: 'Madrid', summary: 'Cocina con isla y dormitorio principal en suite.', cover: 'cocina', alternate: 'dormitorio', deliverables: ['Retoques por zona', 'Montaje 16:9'] },
  { title: 'Adosado en dos plantas', place: 'Sevilla', summary: 'Escalera en U, dormitorio infantil y despacho.', cover: 'infantil', alternate: 'despacho', deliverables: ['Varias plantas', 'Piloto de construcción'] },
  { title: 'Estudio de 42 m²', place: 'Bilbao', summary: 'Una sola estancia bien resuelta con luz cálida.', cover: 'iluminacion', alternate: 'bano', deliverables: ['Techos y luces', 'Imágenes finales'] },
  { title: 'Casa de pueblo', place: 'Cáceres', summary: 'Recibidor, lavadero y garaje recuperados.', cover: 'recibidor', alternate: 'garaje', deliverables: ['Antes y después', 'Exportación .habiteka'] },
];
