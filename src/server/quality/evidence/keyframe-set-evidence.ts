/**
 * Evidencia MEDIBLE de un conjunto de imágenes que servirán de fotogramas clave de un vídeo.
 *
 * Función pura: ni red ni BD, y nunca viajan imágenes. De cada imagen se manda solo su ámbito, vista, luz, nivel de
 * fidelidad y si procede del diseño aprobado; Jev decide con confianza si el conjunto es coherente para animarlo.
 */
import { assessTourHomogeneity, type TourImage } from '@/lib/editor-document/image-tour';

export interface KeyframeSetEvidence {
  imageCount: number;
  /** Cuántas imágenes proceden del diseño aprobado (su revisión o una con el mismo contenido). */
  fromApprovedDesign: number;
  lightings: string[];
  freedoms: string[];
  /** Ámbitos esperados (inmueble y zonas) sin ninguna imagen en el conjunto. */
  missingAmbients: string[];
  ambients: { name: string; views: string[] }[];
  /** Incidencias que ya detecta la comprobación automática, en español. */
  automaticIssues: string[];
}

const MAX_IMAGES = 24;

export function buildKeyframeSetEvidence(shots: TourImage[], valid: ReadonlySet<number>, missingAmbients: string[]): KeyframeSetEvidence {
  const limited = shots.slice(0, MAX_IMAGES);
  const byAmbient = new Map<string, string[]>();
  for (const shot of limited) byAmbient.set(shot.ambient, [...(byAmbient.get(shot.ambient) ?? []), shot.view]);
  return {
    imageCount: limited.length,
    fromApprovedDesign: limited.filter((shot) => valid.has(shot.revision)).length,
    lightings: [...new Set(limited.map((shot) => shot.lighting))].sort(),
    freedoms: [...new Set(limited.map((shot) => shot.freedom))].sort(),
    missingAmbients,
    ambients: [...byAmbient.entries()].map(([name, views]) => ({ name, views })),
    automaticIssues: assessTourHomogeneity(limited, valid, missingAmbients).issues.map((issue) => issue.message),
  };
}

export function explainKeyframeSet(evidence: KeyframeSetEvidence): string[] {
  return evidence.automaticIssues;
}
