import type { Estilo, Plano2dPayload } from '@/lib/contracts';

export interface StudioImage {
  assetUrl: string;
  assetKey?: string;
}

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
}
