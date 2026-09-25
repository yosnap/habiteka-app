import { planIssues, type PlanIssueFix } from './plan-issues';
import { collapseDegenerateWalls, pruneOrphanFloorFinishes } from './plan-repairs';
import type { EditorDocument } from './schema';
import { buildEditorEvidence } from '@/server/quality/evidence/editor-evidence';

export interface PlanReviewProposal {
  fix: PlanIssueFix;
  label: string;
  affectedIds: string[];
  removedWallIds: string[];
  removedOpeningIds: string[];
  removedFloorFinishRoomIds: string[];
}

const labels: Record<PlanIssueFix, string> = {
  'collapse-degenerate-walls': 'Fundir muros de longitud casi nula',
  'prune-orphan-floor-finishes': 'Limpiar acabados de estancias inexistentes',
};

export function applyPlanReviewFix(document: EditorDocument, fix: PlanIssueFix): EditorDocument {
  return fix === 'collapse-degenerate-walls'
    ? collapseDegenerateWalls(document)
    : pruneOrphanFloorFinishes(document);
}

export function planReview(document: EditorDocument) {
  const issues = planIssues(document);
  const evidence = buildEditorEvidence(document);
  const warnings: string[] = [];
  if (evidence.murosSinMedidaFisica > 0 && !evidence.escalaConocida)
    warnings.push(`${evidence.murosSinMedidaFisica} muros proceden de una imagen sin escala física confirmada. Contrasta cotas y ancho general en el editor.`);
  if (!evidence.estanciasDerivables || (evidence.muros > 0 && evidence.estancias === 0))
    warnings.push('Los muros no delimitan estancias revisables. Corrige el contorno antes de generar vistas.');
  if (!evidence.topologiaValida)
    warnings.push(`La topología del plano necesita revisión: ${evidence.falloGeometria ?? 'hay cruces o uniones sin resolver'}.`);
  const proposals = issues.flatMap((issue): PlanReviewProposal[] => {
    if (!issue.fix) return [];
    const next = applyPlanReviewFix(document, issue.fix);
    const nextWalls = new Set(next.walls.map((wall) => wall.id));
    const nextOpenings = new Set(next.openings.map((opening) => opening.id));
    const nextFinishes = new Set((next.floorFinishes ?? []).map((finish) => finish.roomId));
    return [{
      fix: issue.fix,
      label: labels[issue.fix],
      affectedIds: issue.ids,
      removedWallIds: document.walls.filter((wall) => !nextWalls.has(wall.id)).map((wall) => wall.id),
      removedOpeningIds: document.openings.filter((opening) => !nextOpenings.has(opening.id)).map((opening) => opening.id),
      removedFloorFinishRoomIds: (document.floorFinishes ?? [])
        .filter((finish) => !nextFinishes.has(finish.roomId)).map((finish) => finish.roomId),
    }];
  });
  return { revision: document.revision, issues, warnings, proposals };
}
