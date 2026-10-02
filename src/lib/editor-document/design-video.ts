import { z } from 'zod';
import { videoPresentationSchema } from './video-presentation';
import { constructionTiming } from './construction-timing';
import { videoGenerationPrompt } from './video-generation-prompt';
import type { ApprovedLightingPreset } from './approved-design';
import type { RenderDesignOptions } from './render-design-options';
import type { RenderView } from './render-view';

export const designVideoSettingsSchema = z.object({
  presentation: videoPresentationSchema,
  resolution: z.enum(['768P', '2K']),
}).strict();
export type DesignVideoSettings = z.infer<typeof designVideoSettingsSchema>;
export const DESIGN_VIDEO_MODEL = 'minimax-h3/reference-to-video';
export type DesignVideoState = 'prepared' | 'submitting' | 'generating' | 'review' | 'accepted' | 'rejected' | 'failed' | 'unknown';
export interface DesignVideoReference {
  id: string; view: string; name: string; batchId: string | null; revision: number;
  zones: string[]; scope: string; closedRoof: boolean; url: string; issue?: string;
  preset?: RenderView['preset'];
}

/** Una vista fija distribución y muebles; las demás aportan geometría sin mezclar interiorismos. */
export function designVideoLayoutReference(references: readonly DesignVideoReference[]) {
  return references.find(reference => !reference.issue && reference.preset === 'top')
    ?? references.find(reference => !reference.issue && ['isometric', 'drone'].includes(reference.preset ?? ''));
}

/** Selección económica inicial; el usuario puede añadir otras vistas compatibles. */
export function defaultDesignVideoReferenceIds(references: readonly DesignVideoReference[]): string[] {
  const batchId = references.find(reference => !reference.issue)?.batchId;
  if (!batchId) return [];
  const batch = references.filter(reference => !reference.issue && reference.batchId === batchId);
  const layout = designVideoLayoutReference(batch);
  const exterior = batch.find(reference => reference.preset === 'exterior' && reference.closedRoof)
    ?? batch.find(reference => reference.closedRoof);
  return [layout, exterior].flatMap(reference => reference ? [reference.id] : [])
    .filter((id, index, ids) => ids.indexOf(id) === index);
}

export function designVideoReferenceRole(reference: DesignVideoReference, references: readonly DesignVideoReference[]): string {
  if (reference.id === designVideoLayoutReference(references)?.id) return 'Distribución y muebles';
  return reference.closedRoof ? 'Fachadas y tejado' : 'Apoyo de geometría';
}
export interface DesignVideoJob {
  type: 'video'; mode: 'construction-ai'; status: DesignVideoState; provider: 'kie'; model: string;
  approvalId: string; approvedRevision: number; approvedFingerprint: string;
  sourceIds: string[]; sourceScopes: { id: string; options: RenderDesignOptions }[];
  includedZones: string[]; prompt: string; settings: DesignVideoSettings; durationMs: number;
  structuralConstraints?: string;
  estimateUsd: number; credits: number; taskId?: string; assetKey?: string; error?: string;
  title?: string;
}

/** Tarifa KIE contrastada 01/10/2026: salida + imágenes; aquí no se adjunta vídeo de entrada. */
export function designVideoEstimate(settings: DesignVideoSettings, imageCount: number) {
  const seconds = constructionTiming(settings.presentation).durationMs / 1000;
  const cents = seconds * (settings.resolution === '2K' ? 6.5 : 4) + Math.max(0, imageCount - 5) * 2;
  return { usd: Math.round(cents) / 100, credits: Math.ceil(cents) };
}

/** Las imágenes mandan sobre mobiliario y acabados; no se adjunta un inventario de muebles del editor. */
export function designConstructionPrompt(lighting: ApprovedLightingPreset, settings: DesignVideoSettings, references: DesignVideoReference[], structure?: string) {
  const zones = [...new Set(references.flatMap(image => image.zones))];
  const layout = designVideoLayoutReference(references);
  const layoutIndex = layout ? references.indexOf(layout) + 1 : null;
  const exteriorIndex = references.findIndex(reference => reference.closedRoof);
  return [videoGenerationPrompt('construction', lighting, { ...settings.presentation, contentScope: 'all' }),
    'El ámbito es exactamente el de las imágenes elegidas y sus selecciones de diseño, no solo las habitaciones cerradas. Construir también patios, baños exteriores, escaleras, descansillos, rampas, accesos y pérgolas que estén en esas referencias. No añadir el resto de la parcela ni ocultar las partes seleccionadas por estar al exterior.',
    `Zonas expresamente incluidas: ${zones.length ? zones.join(', ') : 'el ámbito completo mostrado en las referencias'}.`,
    ...references.map((image, index) => `Referencia ${index + 1}: ${image.name}; vista ${image.view}; función: ${designVideoReferenceRole(image, references)}.`),
    ...(layoutIndex ? [
      `La referencia ${layoutIndex} es la fuente principal de distribución y mobiliario de TODAS las zonas seleccionadas, incluidos patios: cantidad, posición, orientación, forma, colores y materiales. Las otras imágenes no sustituyen sus camas, sofás, mesas, sillas ni decoración. Si discrepan en esos detalles, seguir únicamente la referencia ${layoutIndex}; no mezclar interiorismos.`,
    ] : []),
    ...(exteriorIndex >= 0 ? [
      `La referencia ${exteriorIndex + 1} fija fachadas cerradas, huecos, tejado, aleros y pérgolas. Usar su cámara oblicua elevada y su encuadre completo desde el suelo vacío hasta terminar la obra; conservar el mobiliario de la referencia principal, aunque esta exterior muestre otro. Mostrar los tabiques antes de cerrar la cubierta. En el vuelo final, hacer solo un desplazamiento suave y corto; no forzar una vuelta completa ni inventar caras ocultas.`,
    ] : []),
    ...(structure ? [structure] : []),
    'Reproducir los muebles de la referencia principal: cantidad, forma, tamaño, posición, materiales y colores. Si el diseño muestra cuatro camas, mantener cuatro aunque el plano original tuviera una. No recuperar el mobiliario de la maqueta ni reducirlo al inventario del plano. No inventar una combinación entre referencias; si la estructura se contradice, no resolverla añadiendo muros o accesos.',
    'Entregar un único clip. No generar cifras ni cotas: necesitan composición posterior. La cubierta final debe conservar la forma, los aleros y los elementos visibles de las referencias.',
  ].join('\n\n');
}
