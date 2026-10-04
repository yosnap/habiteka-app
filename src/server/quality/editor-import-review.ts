import 'server-only';
import { createHash } from 'node:crypto';
import { prisma } from '@/server/db/prisma';
import type { EditorDocument } from '@/lib/editor-document/schema';
import { buildingDocuments } from '@/lib/editor-document/building-levels';
import { editorGeometryFingerprint } from './editor-geometry-fingerprint';
import type { QualityContext } from './evaluate';
import type { EditorQualityScope } from './editor-gate';

/** Registro de aceptación humana, separado de la evaluación automática de Jev. */
export const IMPORT_REVIEW_CHECKPOINT = 'editor_import_manual_review';
export function importReviewFingerprint(document: EditorDocument): string {
  return createHash('sha256').update(JSON.stringify({
    geometry: editorGeometryFingerprint(document), importReview: document.importReview,
    levels: buildingDocuments(document).map(({ id, document: level }) => ({ id, calibration: level.calibration,
      heights: level.walls.map(({ id, heightMm }) => ({ id, heightMm })).sort((a, b) => a.id.localeCompare(b.id)) })),
  })).digest('hex');
}
export async function hasImportReview(ctx: QualityContext, scope: EditorQualityScope, document: EditorDocument) {
  return Boolean(await prisma.aiQualityEvaluation.findFirst({ where: {
    organizationId: ctx.organizationId, projectId: scope.projectId, refId: scope.zoneId ?? null,
    checkpoint: IMPORT_REVIEW_CHECKPOINT, evidenceHash: importReviewFingerprint(document), decision: 'proceed',
  }, select: { id: true } }));
}
export async function saveImportReview(ctx: QualityContext, scope: EditorQualityScope, document: EditorDocument) {
  if (await hasImportReview(ctx, scope, document)) return;
  await prisma.aiQualityEvaluation.create({ data: {
    organizationId: ctx.organizationId, userId: ctx.userId, projectId: scope.projectId, refId: scope.zoneId ?? null,
    checkpoint: IMPORT_REVIEW_CHECKPOINT, evidenceHash: importReviewFingerprint(document), decision: 'proceed',
    score: null, answers: { manualReview: true }, reasons: [], costUsd: 0, failOpen: false,
  } });
}
