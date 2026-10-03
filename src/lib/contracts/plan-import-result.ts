/**
 * Resultado de importar un PLANO DIBUJADO O CREADO (esquemático, CAD, PDF) al
 * editor. Envuelve el `Plano2dPayload` (contrato congelado: muros, huecos,
 * zonas, cotas) con lo que un plano técnico añade y el payload no modela:
 * zonas exteriores con límite lógico, mobiliario colocado desde el catálogo,
 * medidas escritas y las correcciones/avisos del ajuste a cotas.
 *
 * Todo en milímetros, en el mismo sistema de coordenadas que `plano`.
 */
import type { PlanPoint, Plano2dPayload } from './plano2d-payload';

/** Medida escrita en el plano para una estancia (lo que el usuario puede corregir en la tabla). */
export interface WrittenRoomDimensions {
  zoneId: string;
  name: string;
  widthMm?: number;
  heightMm?: number;
  areaM2?: number;
  /** Zona exterior (sin muros que ajustar). */
  exterior?: boolean;
}

/** Corrección revisada de una puerta, identificada en la geometría reconstruida. */
export interface PlanDoorOverride {
  apertureId: string;
  swing?: 'left' | 'right';
  hinge?: 'left' | 'right';
  /** Centro revisado a lo largo del muro final (0–1). */
  position?: number;
  /** Ancho real del hueco revisado, en milímetros. */
  widthMm?: number;
}

/** Corrección de un muro existente; sus vértices compartidos se mueven conjuntamente. */
export interface PlanWallOverride {
  wallId: string;
  from: PlanPoint;
  to: PlanPoint;
  thicknessMm: number;
}

export interface PlanImportReviewOptions {
  includeFurniture?: boolean;
  generalWidthMm?: number | null;
  doorOverrides?: PlanDoorOverride[];
  wallOverrides?: PlanWallOverride[];
  /** Revisión que vio el usuario; evita guardar sobre una importación distinta. */
  revision?: string;
  /** Guardado determinista de la revisión, sin evaluación IA de pago. */
  saveOnly?: boolean;
}

/** Ajuste aplicado por el solver a una estancia y eje. */
export interface DimensionCorrection {
  zoneId: string;
  axis: 'x' | 'y';
  measuredMm: number;
  expectedMm: number;
  /** Desviación que quedó tras el ajuste (0 = cota cumplida). */
  residualMm: number;
}

/** Zona exterior o semiabierta (terraza, patio, porche): recinto sin muros físicos. */
export interface ExteriorZone {
  id: string;
  name: string;
  /** Contorno en mm; los lados sin muro físico se materializan como límites ocultos. */
  outline: PlanPoint[];
  /** Segmentos del contorno que NO coinciden con un muro existente (límite lógico). */
  hiddenBoundaries: Array<{ from: PlanPoint; to: PlanPoint }>;
}

/** Mueble colocado desde el catálogo interno a partir del dibujo. */
export interface ImportedFurniture {
  id: string;
  /** Identificador del catálogo (`habiteka:furniture:…`). */
  catalogId: string;
  kind: string;
  label: string;
  /** Centro en mm. */
  x: number;
  y: number;
  widthMm: number;
  depthMm: number;
  rotation: number;
  /** Zona en la que cae su centro, si alguna. */
  zoneId?: string;
}

export interface PlanImportWarning {
  code:
    | 'cota-no-aplicable'
    | 'cota-contradictoria'
    | 'mueble-fuera-de-estancia'
    | 'mueble-sin-catalogo'
    | 'zona-exterior-sin-contorno'
    | 'estancias-solapadas'
    | 'estancias-fusionadas'
    | 'estancia-inferida'
    | 'cotas-generales-discordantes'
    | 'muro-inferido-omitido'
    | 'muro-solo-modelo'
    | 'ventana-interior-por-revisar'
    | 'arcos-insuficientes'
    | 'ajuste-desplaza-muros';
  message: string;
  zoneId?: string;
}

export interface PlanImportResult {
  plano: Plano2dPayload;
  /** Marco completo de la imagen fuente en el espacio métrico, para alinear la superposición. */
  sourceFrameMm?: { width: number; height: number };
  /** True si la escala es conjetura (sin cotas ni escala gráfica legibles). */
  escalaEstimada: boolean;
  writtenDimensions: WrittenRoomDimensions[];
  corrections: DimensionCorrection[];
  exteriors: ExteriorZone[];
  furniture: ImportedFurniture[];
  warnings: PlanImportWarning[];
}
