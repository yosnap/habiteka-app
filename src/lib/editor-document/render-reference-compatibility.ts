import { isInteriorRenderMode, renderDesignOptionsSchema, type RenderDesignOptions } from './render-design-options';
import type { RenderView } from './render-view';
import { acceptedRenderIssue, renderReviewIssue, type RenderReview } from './render-review';

export type ReferencePreset = 'top' | 'isometric';
export interface ReferenceGeneration {
  provider?: string; documentRevision?: number; review?: RenderReview; fidelity?: { status: string };
  acceptance?: { acceptedAt: string; userId: string };
  view?: { preset?: string; allLevels?: boolean; lighting?: string; levelId?: string | null };
  options?: { freedom?: string; placement?: string; regions?: unknown[]; designScope?: string; redesignFixed?: boolean };
}
export function requiredReferencePreset(view: RenderView, options: RenderDesignOptions): ReferencePreset | null {
  if (isInteriorRenderMode(options)) return null;
  if (view.preset === 'drone') return 'isometric';
  return ['front', 'back', 'left', 'right', 'isometric', 'exterior'].includes(view.preset) ? 'top' : null;
}
/** La biblioteca y la generación explican y comprueban las mismas condiciones. */
export function referenceSettingIssues(generation: ReferenceGeneration | undefined, view: RenderView, options: RenderDesignOptions) {
  const issues: string[] = [];
  if (!generation?.documentRevision) issues.push('No consta la revisión del plano.');
  if (generation?.view?.lighting !== options.lighting) issues.push('La luz es diferente.');
  if ((generation?.view?.levelId ?? null) !== (view.levelId ?? null)) issues.push('La planta es diferente.');
  if ((generation?.view?.allLevels === true) !== (view.allLevels === true)) issues.push('El alcance de plantas es diferente.');
  if (generation?.options?.freedom !== options.freedom) issues.push('La libertad de diseño es diferente.');
  if ((generation?.options?.redesignFixed === true) !== options.redesignFixed) issues.push('El permiso de rediseño de fijos es diferente.');
  if ((generation?.options?.placement === 'selected') !== (options.placement === 'selected') ||
    (options.placement === 'selected' && JSON.stringify(generation?.options?.regions) !== JSON.stringify(options.regions)))
    issues.push('Las zonas de colocación son diferentes.');
  if ((generation?.options?.designScope === 'house') !== (options.designScope === 'house')) issues.push('El ámbito es diferente (solo la casa o toda la planta).');
  return issues;
}
export function referenceAcceptanceIssue(generation?: ReferenceGeneration) {
  const issue = renderReviewIssue(generation);
  if (issue) return issue;
  if (acceptedRenderIssue(generation)) return generation?.provider && generation.provider !== 'native'
    ? 'Revisa la imagen y pulsa Aceptar este diseño.' : 'Esta imagen no tiene un origen IA válido.';
  return null;
}

/** Recupera solo condiciones del ancla, conservando las cámaras que el usuario quiere generar. */
export function optionsFromReference(generation: ReferenceGeneration | undefined, current: RenderDesignOptions): RenderDesignOptions | null {
  if (!generation?.options || !generation.view?.lighting) return null;
  const source = generation.options;
  const parsed = renderDesignOptionsSchema.safeParse({ ...current, lighting: generation.view.lighting, freedom: source.freedom,
    redesignFixed: source.redesignFixed === true, placement: source.placement === 'selected' ? 'selected' : 'all',
    regions: source.placement === 'selected' ? source.regions : [], designScope: source.designScope === 'house' ? 'house' : 'all' });
  return parsed.success ? parsed.data : null;
}
