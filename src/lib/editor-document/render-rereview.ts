import type { DeliverablePayload } from '@/lib/contracts/deliverable';
import { isInteriorRenderMode, renderDesignOptionsSchema, zoneCompositeActive } from './render-design-options';
import { renderReviewIssue } from './render-review';

/**
 * Una cenital de toda la planta generada desde el plano, o una frontal, trasera o lateral generada desde su sección y una
 * cenital aceptada, puede revisarse otra vez sobre la imagen guardada: sus referencias (el plano o la sección de esa
 * revisión y la cenital aceptada) se reconstruyen en el servidor. Las vistas que parten de una captura 3D necesitan la
 * captura preparada y siguen pasando por «Revisar un PNG externo». Un descarte por inspección visual no se reabre.
 */
const SECTION_PRESETS = ['front', 'back', 'left', 'right'];

export function rereviewableRender(payload: DeliverablePayload): boolean {
  if (payload.type !== 'render3d' || payload.imageEdit) return false;
  const generation = payload.generation;
  if (!generation?.provider || generation.provider === 'native' || generation.acceptance || generation.roofClosure) return false;
  if (generation.review?.source === 'visual-inspection' || !renderReviewIssue(generation)) return false;
  const options = renderDesignOptionsSchema.safeParse(generation.options ?? {});
  const preset = generation.view?.preset ?? '';
  const drawn = (preset === 'top' && generation.promptVersion.startsWith('habiteka-plan-simple'))
    || (SECTION_PRESETS.includes(preset) && generation.promptVersion.startsWith('habiteka-section-simple') && Boolean(generation.referenceDesignId));
  return drawn && Boolean(generation.documentRevision) && options.success && !isInteriorRenderMode(options.data) && !zoneCompositeActive(options.data);
}
