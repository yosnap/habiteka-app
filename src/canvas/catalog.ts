/**
 * Catálogo de objetos colocables en el plano, agrupados por categoría.
 *
 * Cada entrada define el tamaño por defecto (en píxeles de stage) con el que se
 * crea el objeto. La forma con que se dibuja cada `kind` la resuelve la capa de
 * render (formas vectoriales en planta). Es la fuente de verdad de la paleta.
 */
import type { StructKind, PlacementRule, CeilingKind, WallSurfaceKind } from './types';

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
  /** Agrupación visual dentro de la categoría (panel 3D). */
  family?: string;
  /** Miniatura WebP de Poly Pizza para el panel 3D; null si no hay. */
  thumbnailUrl?: string;
}

export interface CatalogCategory {
  id: string;
  label: string;
  items: CatalogEntry[];
}

/**
 * Item del catálogo extensible (F1+). Permite muebles de tiendas, custom y
 * builtin en el mismo modelo. Los items builtin derivan de las entradas legacy
 * de CATALOG (id = 'builtin:<kind>').
 */
export interface CatalogItem {
  /** Slug único: 'builtin:sofa', 'store:ikea:kivik', 'custom:<uuid>' */
  id: string;
  name: string;
  /** 'living_room' | 'bedroom' | 'kitchen' | 'lighting' | ... */
  category: string;
  subcategory?: string;
  kind: StructKind | CeilingKind | WallSurfaceKind;
  placement: PlacementRule | 'wall';
  thumbnailUrl: string;
  /** .glb para 3D; null → usa geometría procedural */
  modelUrl?: string;
  defaultDimensions: { wM: number; hM: number; heightM?: number };
  source: 'builtin' | 'custom' | 'store';
  storeInfo?: { store: string; productId: string; price?: number; productUrl?: string };
  tags?: string[];
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
      { kind: 'inodoro', label: 'Inodoro', defaultWidth: 40, defaultHeight: 60, realWidthM: 0.4, realDepthM: 0.6, family: 'WC', thumbnailUrl: 'https://static.poly.pizza/e3c404e8-3149-49ca-92dc-a81d972b71b8.webp' },
      { kind: 'lavabo', label: 'Lavabo', defaultWidth: 50, defaultHeight: 35, realWidthM: 0.6, realDepthM: 0.45, family: 'Lavabos', thumbnailUrl: 'https://static.poly.pizza/fe1011fc-a48c-4fab-8c96-a97a819a68cf.webp' },
      { kind: 'ducha', label: 'Ducha', defaultWidth: 80, defaultHeight: 80, realWidthM: 0.9, realDepthM: 0.9, family: 'Baños', thumbnailUrl: 'https://static.poly.pizza/46cd1ec6-59a0-4a76-8ffc-67bf5f0d4a57.webp' },
      { kind: 'banera', label: 'Bañera', defaultWidth: 160, defaultHeight: 70, realWidthM: 1.7, realDepthM: 0.75, family: 'Baños', thumbnailUrl: 'https://static.poly.pizza/916247c4-bc9f-4dcc-917e-a19f8cab760e.webp' },
      { kind: 'bidet', label: 'Bidé', defaultWidth: 36, defaultHeight: 55, realWidthM: 0.38, realDepthM: 0.55, family: 'WC', thumbnailUrl: 'https://static.poly.pizza/0d33b2e4-c883-4c2c-8108-c47be4e09bc8.webp' },
    ],
  },
  {
    id: 'cocina',
    label: 'Cocina',
    items: [
      { kind: 'nevera', label: 'Nevera', defaultWidth: 70, defaultHeight: 70, realWidthM: 0.7, realDepthM: 0.7, family: 'Neveras', thumbnailUrl: 'https://static.poly.pizza/f4b6db1d-0eed-48b1-9a59-df879aaee393.webp' },
      { kind: 'nevera_americana', label: 'Nevera americana', defaultWidth: 90, defaultHeight: 80, realWidthM: 0.9, realDepthM: 0.8, family: 'Neveras', thumbnailUrl: 'https://static.poly.pizza/d8314c0e-41d5-4530-bd81-633815bd92b7.webp' },
      { kind: 'nevera_mini', label: 'Nevera mini', defaultWidth: 50, defaultHeight: 55, realWidthM: 0.5, realDepthM: 0.55, family: 'Neveras', thumbnailUrl: 'https://static.poly.pizza/6cb84515-e7bd-45fc-a80e-1c557e23259d.webp' },
      { kind: 'horno', label: 'Horno', defaultWidth: 60, defaultHeight: 60, realWidthM: 0.6, realDepthM: 0.6, family: 'Cocción', thumbnailUrl: 'https://static.poly.pizza/9da28115-a156-414e-ab66-159052279eaf.webp' },
      { kind: 'vitroceramica', label: 'Vitrocerámica', defaultWidth: 60, defaultHeight: 60, realWidthM: 0.6, realDepthM: 0.6, family: 'Cocción', thumbnailUrl: 'https://static.poly.pizza/20ac0ba3-07c3-4ec5-ad2c-dc1b836c3006.webp' },
      { kind: 'microondas', label: 'Microondas', defaultWidth: 55, defaultHeight: 38, realWidthM: 0.55, realDepthM: 0.38, family: 'Electrodomésticos', thumbnailUrl: 'https://static.poly.pizza/69b6d111-3ae6-4f6d-8f23-4ded92a021ab.webp' },
      { kind: 'fregadero', label: 'Fregadero', defaultWidth: 80, defaultHeight: 50, realWidthM: 0.8, realDepthM: 0.6, family: 'Fregadero', thumbnailUrl: 'https://static.poly.pizza/df5d73a4-4062-465c-8006-d7b691de66cf.webp' },
      { kind: 'encimera', label: 'Encimera', defaultWidth: 200, defaultHeight: 60, realWidthM: 2.4, realDepthM: 0.6, family: 'Superficies', thumbnailUrl: 'https://static.poly.pizza/0a03826b-80ed-42b4-a5c6-b8591fe867dc.webp' },
      { kind: 'isla', label: 'Isla', defaultWidth: 160, defaultHeight: 90, realWidthM: 1.6, realDepthM: 0.9, family: 'Superficies', thumbnailUrl: 'https://static.poly.pizza/981ead6e-194a-4911-8ede-9b01de2d2ecb.webp' },
    ],
  },
  {
    id: 'mobiliario',
    label: 'Mobiliario',
    items: [
      { kind: 'sofa', label: 'Sofá', defaultWidth: 200, defaultHeight: 90, realWidthM: 2.0, realDepthM: 0.9, family: 'Sofás' },
      { kind: 'sofa_grande', label: 'Sofá grande', defaultWidth: 280, defaultHeight: 100, realWidthM: 2.8, realDepthM: 1.0, family: 'Sofás', thumbnailUrl: 'https://static.poly.pizza/7ac6188b-72be-4c82-81c8-85deab020a1c.webp' },
      { kind: 'butaca', label: 'Butaca', defaultWidth: 90, defaultHeight: 90, realWidthM: 0.9, realDepthM: 0.9, family: 'Sofás', thumbnailUrl: 'https://static.poly.pizza/21d3c956-0747-422c-b06d-6d4392380384.webp' },
      { kind: 'cama', label: 'Cama', defaultWidth: 150, defaultHeight: 200, realWidthM: 1.5, realDepthM: 2.0, family: 'Camas', thumbnailUrl: 'https://static.poly.pizza/1e5a13d0-0dfe-464a-a50c-9a53f69122f2.webp' },
      { kind: 'mesa', label: 'Mesa', defaultWidth: 120, defaultHeight: 80, realWidthM: 1.2, realDepthM: 0.8, family: 'Mesas', thumbnailUrl: 'https://static.poly.pizza/c8fa18f9-e1e9-4aed-905d-cbc945cb44d9.webp' },
      { kind: 'silla', label: 'Silla', defaultWidth: 45, defaultHeight: 45, realWidthM: 0.45, realDepthM: 0.45, family: 'Sillas' },
      { kind: 'armario', label: 'Armario', defaultWidth: 120, defaultHeight: 60, realWidthM: 1.2, realDepthM: 0.6, family: 'Almacenaje', thumbnailUrl: 'https://static.poly.pizza/87908291-7b01-45e9-90b9-fe41d63f511b.webp' },
      { kind: 'estanteria', label: 'Estantería', defaultWidth: 100, defaultHeight: 30, realWidthM: 1.0, realDepthM: 0.3, family: 'Almacenaje', thumbnailUrl: 'https://static.poly.pizza/7d59d0aa-6447-4bbb-afc7-0452e9a34353.webp' },
      { kind: 'mesilla', label: 'Mesilla', defaultWidth: 45, defaultHeight: 45, realWidthM: 0.45, realDepthM: 0.4, family: 'Almacenaje', thumbnailUrl: 'https://static.poly.pizza/1c26c1fe-7fb1-4511-b5f0-3dd73ea10c86.webp' },
    ],
  },
  {
    id: 'electronica',
    label: 'Electrónica',
    items: [
      { kind: 'tv', label: 'TV', defaultWidth: 120, defaultHeight: 16, realWidthM: 1.2, realDepthM: 0.1, family: 'Entretenimiento', thumbnailUrl: 'https://static.poly.pizza/ca849cc2-09f7-49f9-a0e1-b821bac32cc2.webp' },
      { kind: 'ordenador', label: 'Ordenador', defaultWidth: 60, defaultHeight: 40, realWidthM: 0.6, realDepthM: 0.4, family: 'Informática', thumbnailUrl: 'https://static.poly.pizza/8190e659-7079-442f-9ed9-083f67b1746b.webp' },
      { kind: 'lampara', label: 'Lámpara', defaultWidth: 40, defaultHeight: 40, realWidthM: 0.4, realDepthM: 0.4, family: 'Iluminación', thumbnailUrl: 'https://static.poly.pizza/19259c43-99cb-43c6-aaee-dcf8d1d36fdb.webp' },
    ],
  },
  {
    id: 'decoracion',
    label: 'Decoración',
    items: [
      { kind: 'alfombra', label: 'Alfombra', defaultWidth: 160, defaultHeight: 110, realWidthM: 1.6, realDepthM: 1.2, family: 'Tapetes', thumbnailUrl: 'https://static.poly.pizza/06a5cc94-d146-4ee6-8506-1be516dc4dbd.webp' },
      { kind: 'planta', label: 'Planta', defaultWidth: 45, defaultHeight: 45, realWidthM: 0.45, realDepthM: 0.45, family: 'Plantas', thumbnailUrl: 'https://static.poly.pizza/41d278fd-ceb3-425b-800d-ca434be134d0.webp' },
      { kind: 'chimenea', label: 'Chimenea', defaultWidth: 120, defaultHeight: 40, realWidthM: 1.2, realDepthM: 0.4, family: 'Chimeneas', thumbnailUrl: 'https://static.poly.pizza/7841807d-cab9-46e2-95c2-1ca0bbee5736.webp' },
    ],
  },
  {
    id: 'iluminacion',
    label: 'Iluminación',
    items: [
      // El foco es una luz de PRIMERA CLASE: además del kind, lleva atributos
      // `light` (color/intensidad). La `lampara` (en Electrónica) es solo mueble.
      { kind: 'foco', label: 'Foco', defaultWidth: 40, defaultHeight: 40, realWidthM: 0.3, realDepthM: 0.3 },
      // Luces de techo (CeilingLightKind): placement = 'ceiling', se renderizan en CeilingLayer.
      { kind: 'ceiling_light', label: 'Plafón', defaultWidth: 40, defaultHeight: 40, realWidthM: 0.4, realDepthM: 0.4, family: 'Techo' },
      { kind: 'pendant_lamp', label: 'Colgante', defaultWidth: 30, defaultHeight: 30, realWidthM: 0.3, realDepthM: 0.3, family: 'Techo' },
    ],
  },
];

/** Índice plano kind → entrada, para resolver el tamaño por defecto al crear. */
export const CATALOG_BY_KIND: Record<string, CatalogEntry> = Object.fromEntries(
  CATALOG.flatMap((c) => c.items).map((e) => [e.kind, e]),
);
