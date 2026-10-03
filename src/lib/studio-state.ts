import type { Estilo, Plano2dPayload, WrittenRoomDimensions } from '@/lib/contracts';
import type { QualityDecisionValue, QualityVerdict } from '@/lib/quality-verdict';
import type { RawSketch } from '@/server/ai/sketch/sketch-types';
import type { DetectedWalls } from '@/server/plan/detect-walls-raster';

export interface StudioImage {
  assetUrl: string;
  assetKey?: string;
}

/** Referencia histórica: se persiste la clave, nunca la URL firmada que caduca. */
export interface StudioResult {
  id: string;
  kind: 'source' | 'redraw' | 'render';
  assetKey: string;
  createdAt: string | null;
  sourceKey?: string;
  mode?: 'tecnico' | 'decorado';
  vista?: 'cenital' | 'maqueta';
  estilo?: Estilo;
}

export interface StudioResultView extends StudioResult {
  url: string | null;
}

/** Veredicto de la puerta de calidad sobre el último análisis del estudio. */
export type StudioQuality = QualityVerdict;
export type { QualityDecisionValue };

export interface StudioState {
  sourceKind?: 'drawing' | 'canvas' | 'upload';
  source?: StudioImage;
  plan?: StudioImage;
  cenital?: StudioImage;
  plano?: Plano2dPayload;
  escalaEstimada?: boolean;
  estilo?: Estilo;
  detalles?: string;
  canvasDescription?: string;
  /** Modo del redibujado ACTIVO (`plan`): técnico para extraer geometría, decorado para presentar. */
  redrawMode?: 'tecnico' | 'decorado';
  /**
   * Último redibujado de cada modo. Se conservan ambos para alternar sin
   * volver a generar; `plan` apunta al seleccionado.
   */
  redraws?: Partial<Record<'tecnico' | 'decorado', StudioImage>>;
  /** Historial de imágenes del estudio, incluidas las generaciones anteriores. */
  results?: StudioResult[];
  /** Tipo de la última vista generada. */
  vista?: 'cenital' | 'maqueta';
  /**
   * Extracción cruda del último plano importado (modelo + raster). Permite
   * recalcular el ajuste a cotas desde la tabla sin volver a llamar a la IA.
   */
  planImport?: {
    raw: RawSketch;
    detected: DetectedWalls | null;
    /** Ajustes manuales necesarios para reconstruir la misma revisión tras recargar. */
    roomOverrides?: WrittenRoomDimensions[];
    doorOverrides?: import('@/lib/contracts').PlanDoorOverride[];
    wallOverrides?: import('@/lib/contracts').PlanWallOverride[];
    generalWidthMm?: number;
    includeFurniture?: boolean;
    /** Imagen de la que se extrajo (subida o redibujado): la superposición del panel la usa. */
    image?: StudioImage;
  };
  /** Último plano activo del estudio confirmado y enviado al editor. */
  planImportApplied?: boolean;
  /** Identificador de la última revisión de medidas para refrescar el panel al volver. */
  planImportRevision?: string;
  /** Fiabilidad del último plano importado; decide si se puede seguir sin corregirlo. */
  quality?: StudioQuality;
}
