import type { CameraPose } from '@/lib/contracts/walkthrough-keyframe';
import type { Point } from './schema';

export interface PropertyVisitEntry {
  id: string; label: string; levelId: string; roomId: string;
  outside: Point; inside: Point; issue?: string;
}
export interface PropertyVisitFrame {
  id: string; label: string; roomId: string | null; levelId: string;
  camera: CameraPose; secondsFromPrevious: number;
}
export interface PropertyVisitCoverage {
  id: string; roomId: string; levelId: string; name: string;
  status: 'planned' | 'pending'; issue?: string;
}
/** Preparación geométrica: no acredita diseños ni autoriza generación o exportación. */
export interface PropertyVisitPlan {
  entry: PropertyVisitEntry | null;
  coverage: PropertyVisitCoverage[];
  frames: PropertyVisitFrame[];
  /** Ruta geométrica completa entre los encuadres de los clips; no son imágenes finales. */
  pathFrames?: PropertyVisitFrame[];
  durationSeconds: number;
  issues: string[];
  complete: boolean;
}
