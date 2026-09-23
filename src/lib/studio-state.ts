import type { Estilo, Plano2dPayload } from '@/lib/contracts';
import type { QualityDecisionValue, QualityVerdict } from '@/lib/quality-verdict';
import type { RawSketch } from '@/server/ai/sketch/sketch-types';
import type { DetectedWalls } from '@/server/plan/detect-walls-raster';

export interface StudioImage {
  assetUrl: string;
  assetKey?: string;
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
  /** Tipo de la última vista generada. */
  vista?: 'cenital' | 'maqueta';
  /**
   * Extracción cruda del último plano importado (modelo + raster). Permite
   * recalcular el ajuste a cotas desde la tabla sin volver a llamar a la IA.
   */
  planImport?: {
    raw: RawSketch;
    detected: DetectedWalls | null;
    /** Imagen de la que se extrajo (subida o redibujado): la superposición del panel la usa. */
    image?: StudioImage;
  };
  /** Fiabilidad del último plano importado; decide si se puede seguir sin corregirlo. */
  quality?: StudioQuality;
}
