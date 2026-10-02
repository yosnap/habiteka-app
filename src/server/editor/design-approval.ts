import type { EditorDocument } from '@/lib/editor-document/schema';
import { buildEditorEvidence } from '@/server/quality/evidence/editor-evidence';
import { buildingDocuments } from '@/lib/editor-document/building-levels';
import { planIssues } from '@/lib/editor-document/plan-issues';
import { deriveRooms } from '@/lib/editor-document/rooms';

/** La aprobación exige un modelo transitable y una escala revisable en todas las plantas. */
export function designApprovalIssues(document: EditorDocument): string[] {
  const evidence = buildEditorEvidence(document);
  const issues: string[] = [];
  if (!evidence.escalaConocida) issues.push('Confirma una escala física antes de aprobar el diseño.');
  if (!evidence.topologiaValida) issues.push(`Revisa la topología: ${evidence.falloGeometria ?? 'hay uniones inválidas'}.`);
  for (const level of buildingDocuments(document)) {
    const name = document.levels?.find((item) => item.id === level.id)?.name ?? 'Planta';
    let rooms = 0;
    try { rooms = deriveRooms(level.document).length; }
    catch { issues.push(`${name}: no se pueden deducir las estancias.`); }
    if (!rooms) issues.push(`${name}: cierra al menos una estancia antes de aprobar.`);
    issues.push(...planIssues(level.document).map((issue) => `${name}: ${issue.message}`));
  }
  return [...new Set(issues)];
}
