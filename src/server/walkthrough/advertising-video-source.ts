import 'server-only';
import type { OrgContext } from '@/server/auth/org-context';
import type { EditorScope } from '@/server/editor/authority';
import { withEditorDocuments } from '@/server/editor/document-repo';
import { prisma } from '@/server/db/prisma';
import { sameVisualDesignContent } from './tour-images';
import { resolveRenderUrl } from '@/server/storage/render-urls';
import { videoMeasurements } from '@/lib/editor-document/video-measurements';
import { fail } from '@/server/errors/run-action';
import { isDesignVideoMode } from '@/lib/editor-document/design-video';

export async function advertisingVideoSource(ctx: OrgContext, scope: EditorScope, approvalId: string, sourceId: string) {
  const repo = withEditorDocuments(ctx), approved = await repo.readApproval(scope, approvalId), current = await repo.load(scope);
  if (current.authority !== 'v2' || !sameVisualDesignContent(current.document, approved.document))
    fail('El diseño ha cambiado. Revisa la aprobación antes de preparar el anuncio.');
  const row = await prisma.deliverable.findFirst({ where: { id: sourceId, projectId: scope.projectId, zoneId: scope.zoneId ?? null,
    type: 'VIDEO', deletedAt: null, project: { organizationId: ctx.organizationId, deletedAt: null } } });
  const payload = row?.payload as { assetKey?: string; approvalId?: string; approvedFingerprint?: string; durationMs?: number; mode?: string; status?: string } | undefined;
  if (!payload?.assetKey || payload.approvalId !== approved.id || payload.approvedFingerprint !== approved.fingerprint)
    fail('El clip no pertenece a este diseño aprobado o no tiene archivo guardado.');
  if (payload.mode === 'advertising') fail('Elige el vídeo original para evitar duplicar sus medidas.');
  if (isDesignVideoMode(payload.mode) && payload.status !== 'accepted')
    fail('Revisa y acepta la fidelidad del clip H3 antes de usarlo en publicidad.');
  if (!Number.isFinite(payload.durationMs) || payload.durationMs! <= 0 || payload.durationMs! > 110000)
    fail('El clip debe durar como máximo 110 segundos.');
  const url = await resolveRenderUrl(payload); if (!url) fail('El archivo del clip no está disponible.');
  return { approved, url, durationMs: payload.durationMs!, measurements: videoMeasurements(approved.document) };
}
