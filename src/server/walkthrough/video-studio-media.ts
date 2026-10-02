'use server';
import { requireOrgContext } from '@/server/auth/require-org-context';
import { withOrg } from '@/server/db/scoped-repo';
import { withEditorDocuments } from '@/server/editor/document-repo';
import type { EditorScope } from '@/server/editor/authority';
import { resolveRenderUrl } from '@/server/storage/render-urls';
import { sameContentRevisions, sameVisualDesignContent, tourImagesFromRows, tourDocumentReader } from './tour-images';
import { WHOLE_PROPERTY } from '@/lib/editor-document/image-tour';
import { videoPresentationSchema } from '@/lib/editor-document/video-presentation';
import type { DesignVideoJob } from '@/lib/editor-document/design-video';
import { advertisingVideoSchema } from '@/lib/editor-document/advertising-video';
import { readVideoTitle } from '@/lib/editor-document/video-title';

/** Un único ámbito para imágenes, aprobación y vídeos: conserva la zona activa. */
export async function loadVideoStudioMedia(scope: EditorScope) {
  const ctx = await requireOrgContext(), documents = withEditorDocuments(ctx);
  const current = await documents.load(scope);
  const approval = await documents.latestApproval(scope);
  const rows = (await withOrg(ctx).deliverables.list(scope.projectId)).filter(row => (row.zoneId ?? null) === (scope.zoneId ?? null));
  const images = await tourImagesFromRows(rows.filter(row => row.type === 'RENDER_3D'), tourDocumentReader(ctx, scope));
  const validRevisions = approval ? await sameContentRevisions(ctx, scope, approval, images.map(image => image.revision)) : [];
  const videos = await Promise.all(rows.filter(row => row.type === 'VIDEO').map(async row => {
    const payload = row.payload && typeof row.payload === 'object'
      ? row.payload as { mode?: string; assetKey?: string; durationMs?: number; approvalId?: string; approvedRevision?: number; contentScope?: string; presentation?: unknown; advertising?: unknown } : {};
    const presentation = videoPresentationSchema.safeParse(payload.presentation);
    const advertising = advertisingVideoSchema.safeParse(payload.advertising);
    return { id: row.id, title: readVideoTitle(row.payload), mode: payload.mode ?? 'walkthrough', url: await resolveRenderUrl(payload),
      durationMs: payload.durationMs ?? 0, approvalId: payload.approvalId ?? null, approvedRevision: payload.approvedRevision ?? null,
      advertising: advertising.success ? advertising.data : null,
      contentScope: payload.contentScope ?? 'all', createdAt: row.createdAt.toISOString(), presentation: presentation.success ? presentation.data : null,
      designJob: payload.mode === 'construction-ai' ? row.payload as unknown as DesignVideoJob : null };
  }));
  return { images, validRevisions, videos, approvalId: approval?.id ?? null, approvedRevision: approval?.revision ?? null,
    ambients: [WHOLE_PROPERTY, ...(approval?.document.designZones ?? []).map(zone => zone.name)],
    approvalOutdated: !!approval && (current.authority !== 'v2' || !sameVisualDesignContent(current.document, approval.document)) };
}
