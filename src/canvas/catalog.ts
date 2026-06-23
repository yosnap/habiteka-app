/**
 * Catálogo de objetos colocables en el plano, agrupados por categoría.
 *
 * Cada entrada define el tamaño por defecto (en píxeles de stage) con el que se
 * crea el objeto. La forma con que se dibuja cada `kind` la resuelve la capa de
 * render (formas vectoriales en planta). Es la fuente de verdad de la paleta.
 */
import type { StructKind } from './types';

export interface CatalogEntry {
  kind: StructKind;
  label: string;
  /** Tamaño por defecto en píxeles de stage (fallback cuando NO hay escala). */
  defaultWidth: number;
  defaultHeight: number;
  /**
   * Medidas REALES en metros (largo × fondo en planta). Cuando el plano tiene
   * escala, el objeto nace con estas medidas convertidas a px, para que un objeto
   * recién colocado tenga un tamaño realista (una puerta de 0,9 m, no "lo que
   * midan 60 px"). `realDepthM` es el fondo/grosor visto en planta.
   */
  realWidthM: number;
  realDepthM: number;
}

export interface CatalogCategory {
  id: string;
  label: string;
  items: CatalogEntry[];
}

export const CATALOG: CatalogCategory[] = [
  {
    id: 'estructura',
    label: 'Estructura',
    items: [
      // Muros/aperturas: realDepthM es el GROSOR (muro ~15 cm, hoja de puerta ~5 cm).
      { kind: 'wall', label: 'Muro', defaultWidth: 160, defaultHeight: 12, realWidthM: 3, realDepthM: 0.15 },
      { kind: 'window', label: 'Ventana', defaultWidth: 80, defaultHeight: 12, realWidthM: 1.2, realDepthM: 0.15 },
      { kind: 'door', label: 'Puerta', defaultWidth: 60, defaultHeight: 12, realWidthM: 0.9, realDepthM: 0.1 },
    ],
  },
  {
    id: 'sanitarios',
    label: 'Sanitarios',
    items: [
      { kind: 'inodoro', label: 'Inodoro', defaultWidth: 40, defaultHeight: 60, realWidthM: 0.4, realDepthM: 0.6 },
      { kind: 'lavabo', label: 'Lavabo', defaultWidth: 50, defaultHeight: 35, realWidthM: 0.6, realDepthM: 0.45 },
      { kind: 'ducha', label: 'Ducha', defaultWidth: 80, defaultHeight: 80, realWidthM: 0.9, realDepthM: 0.9 },
      { kind: 'banera', label: 'Bañera', defaultWidth: 160, defaultHeight: 70, realWidthM: 1.7, realDepthM: 0.75 },
      { kind: 'bidet', label: 'Bidé', defaultWidth: 36, defaultHeight: 55, realWidthM: 0.38, realDepthM: 0.55 },
    ],
  },
  {
    id: 'cocina',
    label: 'Cocina',
    items: [
      { kind: 'fregadero', label: 'Fregadero', defaultWidth: 80, defaultHeight: 50, realWidthM: 0.8, realDepthM: 0.6 },
      { kind: 'encimera', label: 'Encimera', defaultWidth: 200, defaultHeight: 60, realWidthM: 2.4, realDepthM: 0.6 },
      { kind: 'nevera', label: 'Nevera', defaultWidth: 70, defaultHeight: 70, realWidthM: 0.7, realDepthM: 0.7 },
      { kind: 'horno', label: 'Horno', defaultWidth: 60, defaultHeight: 60, realWidthM: 0.6, realDepthM: 0.6 },
      { kind: 'isla', label: 'Isla', defaultWidth: 160, defaultHeight: 90, realWidthM: 1.6, realDepthM: 0.9 },
      { kind: 'vitroceramica', label: 'Vitrocerámica', defaultWidth: 60, defaultHeight: 60, realWidthM: 0.6, realDepthM: 0.6 },
      { kind: 'microondas', label: 'Microondas', defaultWidth: 55, defaultHeight: 38, realWidthM: 0.55, realDepthM: 0.38 },
    ],
  },
  {
    id: 'mobiliario',
    label: 'Mobiliario',
    items: [
      { kind: 'cama', label: 'Cama', defaultWidth: 150, defaultHeight: 200, realWidthM: 1.5, realDepthM: 2.0 },
      { kind: 'sofa', label: 'Sofá', defaultWidth: 200, defaultHeight: 90, realWidthM: 2.0, realDepthM: 0.9 },
      { kind: 'mesa', label: 'Mesa', defaultWidth: 120, defaultHeight: 80, realWidthM: 1.2, realDepthM: 0.8 },
      { kind: 'silla', label: 'Silla', defaultWidth: 45, defaultHeight: 45, realWidthM: 0.45, realDepthM: 0.45 },
      { kind: 'armario', label: 'Armario', defaultWidth: 120, defaultHeight: 60, realWidthM: 1.2, realDepthM: 0.6 },
      { kind: 'estanteria', label: 'Estantería', defaultWidth: 100, defaultHeight: 30, realWidthM: 1.0, realDepthM: 0.3 },
      { kind: 'mesilla', label: 'Mesilla', defaultWidth: 45, defaultHeight: 45, realWidthM: 0.45, realDepthM: 0.4 },
    ],
  },
  {
    id: 'electronica',
    label: 'Electrónica',
    items: [
      { kind: 'tv', label: 'TV', defaultWidth: 120, defaultHeight: 16, realWidthM: 1.2, realDepthM: 0.1 },
      { kind: 'ordenador', label: 'Ordenador', defaultWidth: 60, defaultHeight: 40, realWidthM: 0.6, realDepthM: 0.4 },
      { kind: 'lampara', label: 'Lámpara', defaultWidth: 40, defaultHeight: 40, realWidthM: 0.4, realDepthM: 0.4 },
    ],
  },
  {
    id: 'decoracion',
    label: 'Decoración',
    items: [
      { kind: 'alfombra', label: 'Alfombra', defaultWidth: 160, defaultHeight: 110, realWidthM: 1.6, realDepthM: 1.2 },
      { kind: 'planta', label: 'Planta', defaultWidth: 45, defaultHeight: 45, realWidthM: 0.45, realDepthM: 0.45 },
      { kind: 'chimenea', label: 'Chimenea', defaultWidth: 120, defaultHeight: 40, realWidthM: 1.2, realDepthM: 0.4 },
    ],
  },
  {
    id: 'iluminacion',
    label: 'Iluminación',
    items: [
      // El foco es una luz de PRIMERA CLASE: además del kind, lleva atributos
      // `light` (color/intensidad). La `lampara` (en Electrónica) es solo mueble.
      { kind: 'foco', label: 'Foco', defaultWidth: 40, defaultHeight: 40, realWidthM: 0.3, realDepthM: 0.3 },
    ],
  },
];

/** Índice plano kind → entrada, para resolver el tamaño por defecto al crear. */
export const CATALOG_BY_KIND: Record<string, CatalogEntry> = Object.fromEntries(
  CATALOG.flatMap((c) => c.items).map((e) => [e.kind, e]),
);
