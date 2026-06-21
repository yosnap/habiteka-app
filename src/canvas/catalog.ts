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
  defaultWidth: number;
  defaultHeight: number;
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
      { kind: 'wall', label: 'Muro', defaultWidth: 160, defaultHeight: 12 },
      { kind: 'window', label: 'Ventana', defaultWidth: 80, defaultHeight: 12 },
      { kind: 'door', label: 'Puerta', defaultWidth: 60, defaultHeight: 12 },
    ],
  },
  {
    id: 'sanitarios',
    label: 'Sanitarios',
    items: [
      { kind: 'inodoro', label: 'Inodoro', defaultWidth: 40, defaultHeight: 60 },
      { kind: 'lavabo', label: 'Lavabo', defaultWidth: 50, defaultHeight: 35 },
      { kind: 'ducha', label: 'Ducha', defaultWidth: 80, defaultHeight: 80 },
      { kind: 'banera', label: 'Bañera', defaultWidth: 160, defaultHeight: 70 },
      { kind: 'bidet', label: 'Bidé', defaultWidth: 36, defaultHeight: 55 },
    ],
  },
  {
    id: 'cocina',
    label: 'Cocina',
    items: [
      { kind: 'fregadero', label: 'Fregadero', defaultWidth: 80, defaultHeight: 50 },
      { kind: 'encimera', label: 'Encimera', defaultWidth: 200, defaultHeight: 60 },
      { kind: 'nevera', label: 'Nevera', defaultWidth: 70, defaultHeight: 70 },
      { kind: 'horno', label: 'Horno', defaultWidth: 60, defaultHeight: 60 },
      { kind: 'isla', label: 'Isla', defaultWidth: 160, defaultHeight: 90 },
    ],
  },
  {
    id: 'mobiliario',
    label: 'Mobiliario',
    items: [
      { kind: 'cama', label: 'Cama', defaultWidth: 150, defaultHeight: 200 },
      { kind: 'sofa', label: 'Sofá', defaultWidth: 200, defaultHeight: 90 },
      { kind: 'mesa', label: 'Mesa', defaultWidth: 120, defaultHeight: 80 },
      { kind: 'silla', label: 'Silla', defaultWidth: 45, defaultHeight: 45 },
      { kind: 'armario', label: 'Armario', defaultWidth: 120, defaultHeight: 60 },
      { kind: 'estanteria', label: 'Estantería', defaultWidth: 100, defaultHeight: 30 },
      { kind: 'mesilla', label: 'Mesilla', defaultWidth: 45, defaultHeight: 45 },
    ],
  },
  {
    id: 'electronica',
    label: 'Electrónica',
    items: [
      { kind: 'tv', label: 'TV', defaultWidth: 120, defaultHeight: 16 },
      { kind: 'ordenador', label: 'Ordenador', defaultWidth: 60, defaultHeight: 40 },
      { kind: 'lampara', label: 'Lámpara', defaultWidth: 40, defaultHeight: 40 },
    ],
  },
  {
    id: 'decoracion',
    label: 'Decoración',
    items: [
      { kind: 'alfombra', label: 'Alfombra', defaultWidth: 160, defaultHeight: 110 },
      { kind: 'planta', label: 'Planta', defaultWidth: 45, defaultHeight: 45 },
      { kind: 'chimenea', label: 'Chimenea', defaultWidth: 120, defaultHeight: 40 },
    ],
  },
];

/** Índice plano kind → entrada, para resolver el tamaño por defecto al crear. */
export const CATALOG_BY_KIND: Record<string, CatalogEntry> = Object.fromEntries(
  CATALOG.flatMap((c) => c.items).map((e) => [e.kind, e]),
);
