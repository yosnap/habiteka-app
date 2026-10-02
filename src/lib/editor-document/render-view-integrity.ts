import type { EditorDocument } from './schema';
import type { RenderView } from './render-view';
import { buildingDocuments } from './building-levels';
import { wallSelectionGroups } from './exterior-wall-selection';

/** Comprueba el recorte registrado; no intenta reparar los píxeles de una foto antigua. */
export function renderViewIntegrityIssue(document: EditorDocument, view?: Partial<RenderView>): string | null {
  if (!view) return 'La imagen no tiene una vista registrada. Vuelve a preparar y generar esa vista.';
  if (view.preset === 'exterior' && (view.cutaway !== false || view.ceilingView !== 'solid'))
    return 'Exterior terminado necesita fachadas completas y cubierta visible. Vuelve a preparar esa vista.';
  const ids = view.cutawayWallIds ?? [];
  if (view.cutaway && !view.cutawayWallIds)
    return 'No se registraron los muros ocultos. Vuelve a preparar y generar esa vista.';
  if (!view.cutaway && ids.length)
    return 'La vista registra muros ocultos sin un recorte válido. Vuelve a prepararla.';
  if (!ids.length) return null;
  const levelId = view.levelId ?? document.activeLevelId ?? 'ground';
  const levels = buildingDocuments(document).filter(level => view.allLevels || level.id === levelId);
  const known = new Set(levels.flatMap(level => level.document.walls.filter(wall => !wall.hidden).map(wall => wall.id)));
  const interiors = new Set(levels.flatMap(level => wallSelectionGroups(level.document).interior));
  const hiddenInteriors = [...new Set(ids)].filter(id => interiors.has(id));
  if (hiddenInteriors.length)
    return `Esta vista oculta ${hiddenInteriors.length} tabiques interiores. Vuelve a preparar y generar la vista conservando la distribución.`;
  if (ids.some(id => !known.has(id)))
    return 'El recorte no corresponde a los muros de esta planta. Vuelve a preparar y generar esa vista.';
  return null;
}

export function assertRenderViewIntegrity(document: EditorDocument, view: RenderView): void {
  const issue = renderViewIntegrityIssue(document, view);
  if (issue) throw new Error(issue);
}
