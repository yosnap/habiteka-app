import { designVideoLayoutReference, type DesignVideoReference } from './design-video';
import { designVisitSelectionIssue } from './design-visit';

/** Anticipa en la interfaz los bloqueos de selección; el servidor vuelve a validar las fuentes. */
export function designConstructionSelectionIssue(references: readonly DesignVideoReference[]): string | null {
  if (!references.length) return 'Elige una vista de distribución y un exterior terminado de la misma tanda.';
  if (references.length > 9) return 'H3 admite hasta nueve imágenes. Reduce la selección a una misma tanda.';
  if (new Set(references.map(reference => reference.id)).size !== references.length) return 'No repitas una imagen en la selección.';
  const invalid = references.find(reference => reference.issue);
  if (invalid) return `${invalid.view}: ${invalid.issue}`;
  const batches = new Set(references.map(reference => reference.batchId));
  if (batches.size !== 1 || batches.has(null)) return 'Elige imágenes de una misma tanda. Quita las de otras tandas antes de continuar.';
  if (!designVideoLayoutReference(references)) return 'Añade una cenital, isométrica o dron del conjunto de esta tanda.';
  if (!references.some(reference => reference.closedRoof)) return 'Añade un exterior terminado de esta tanda, o cierra el tejado desde el modelo sobre su isométrica o dron aceptados.';
  return null;
}

export function designVideoPreparationIssue({ goal, approved, loading, loadError, approvalId, providerReady, references }: {
  goal: 'construction' | 'visit'; approved: boolean; loading: boolean; loadError?: string;
  approvalId: string | null; providerReady: boolean; references: readonly DesignVideoReference[];
}): string | null {
  if (loading) return 'Cargando los diseños y sus requisitos…';
  if (loadError) return 'No se pudieron actualizar los diseños. Pulsa Actualizar diseños para reintentar.';
  if (!approved || !approvalId) return 'Revisa la versión del proyecto y su luz. Esto no acepta las imágenes por ti.';
  const selectionIssue = goal === 'visit' ? designVisitSelectionIssue(references) : designConstructionSelectionIssue(references);
  if (selectionIssue) return selectionIssue;
  if (!providerReady) return 'KIE no está activo. Revisa los ajustes de IA antes de preparar la prueba.';
  return null;
}
