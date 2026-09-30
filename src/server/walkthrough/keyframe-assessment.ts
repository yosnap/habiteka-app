'use server';
import { requireOrgContext } from '@/server/auth/require-org-context';
import { withEditorDocuments } from '@/server/editor/document-repo';
import type { EditorScope } from '@/server/editor/authority';
import { prisma } from '@/server/db/prisma';
import { fail, runAction } from '@/server/errors/run-action';
import { evaluateCheckpoint } from '@/server/quality/evaluate';
import { VIDEO_KEYFRAMES_CHECKPOINT } from '@/server/quality/checkpoints-video';
import { buildKeyframeSetEvidence } from '@/server/quality/evidence/keyframe-set-evidence';
import { MAX_TOUR_SHOTS, WHOLE_PROPERTY } from '@/lib/editor-document/image-tour';
import { sameContentRevisions, tourImagesFromRows } from './tour-images';

export interface KeyframeAssessment {
  /** Decisión de Jev: proceed = animar, confirm = revisar antes, block = regenerar. */
  decision: 'proceed' | 'confirm' | 'block';
  score: number | null;
  confidence: number | null;
  reasons: string[];
  /** `false` si Jev no estuvo disponible y la decisión sale de la política de fallo. */
  fromJev: boolean;
  validRevisions: number[];
}

/**
 * Pide a Jev que decida si las imágenes elegidas forman un conjunto homogéneo para animarlas. Informativa: no cobra
 * ni bloquea por sí sola. El botón del vídeo con IA la exigirá cuando exista; el montaje con imágenes solo la muestra.
 */
export async function assessKeyframeSet(scope: EditorScope, approvalId: string, deliverableIds: string[]) {
  return runAction(() => assessKeyframeSetImpl(scope, approvalId, deliverableIds));
}

async function assessKeyframeSetImpl(scope: EditorScope, approvalId: string, deliverableIds: string[]): Promise<KeyframeAssessment> {
  const ctx = await requireOrgContext();
  if (!Array.isArray(deliverableIds) || !deliverableIds.length || deliverableIds.length > MAX_TOUR_SHOTS ||
    deliverableIds.some((id) => typeof id !== 'string' || !id)) fail(`Elige de 1 a ${MAX_TOUR_SHOTS} imágenes.`);
  const approved = await withEditorDocuments(ctx).readApproval(scope, approvalId);
  const rows = await prisma.deliverable.findMany({ where: { id: { in: deliverableIds }, projectId: scope.projectId,
    project: { organizationId: ctx.organizationId }, type: 'RENDER_3D', deletedAt: null, zoneId: scope.zoneId ?? null },
    select: { id: true, payload: true, createdAt: true } });
  // Las revisiones son por estado del editor (proyecto y zona): solo cuentan los renders del mismo ámbito.
  if (rows.length !== new Set(deliverableIds).size) fail('Alguna imagen no pertenece a este proyecto o a este ámbito.');
  const shots = await tourImagesFromRows(rows);
  // Una imagen ilegible no puede desaparecer en silencio: Jev evaluaría un conjunto que no es el elegido.
  if (shots.length !== rows.length) fail('Alguna imagen elegida no tiene archivo disponible.');
  const validRevisions = await sameContentRevisions(ctx, scope, approved, shots.map((shot) => shot.revision));
  const present = new Set(shots.map((shot) => shot.ambient));
  const expected = [WHOLE_PROPERTY, ...(approved.document.designZones ?? []).map((zone) => zone.name)];
  const evidence = buildKeyframeSetEvidence(shots, new Set(validRevisions), expected.filter((name) => !present.has(name)));
  const result = await evaluateCheckpoint(ctx, VIDEO_KEYFRAMES_CHECKPOINT, evidence, { projectId: scope.projectId });
  return { decision: result.decision, score: result.score, confidence: result.confidence, reasons: result.reasons,
    fromJev: result.failOpen, validRevisions };
}
