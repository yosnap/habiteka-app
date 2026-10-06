import { notFound } from 'next/navigation';
import { requireOrgContext } from '@/server/auth/require-org-context';
import { withOrg } from '@/server/db/scoped-repo';
import { withEditorDocuments } from '@/server/editor/document-repo';
import { fromCanvasV1 } from '@/lib/editor-document/adapters/canvas-v1';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { ProjectEditor } from './project-editor';
import type { AutoGenerateRequest } from '../auto-generate-request';
import { loadStudio } from '@/server/plan/studio-repo';
import { buildPlanImport } from '@/server/plan/build-plan-import';
import type { PlanReference } from '@/lib/editor-document/plan-reference';
import { resolveRenderUrl } from '@/server/storage/render-urls';
import { loadRenderBatchContinuation } from '@/server/agent/editor-v2/render-batch-continuation';
import { UserFacingError } from '@/server/errors/user-facing-error';

export async function ProjectEditorPage({ projectId, zoneId, autoGenerate, approvedId, continuationId }: {
  projectId: string; zoneId?: string; autoGenerate?: AutoGenerateRequest | null; approvedId?: string; continuationId?: string;
}) {
  const ctx = await requireOrgContext();
  const project = await withOrg(ctx).projects.findById(projectId);
  if (!project) notFound();

  const scope = { userId: ctx.userId, organizationId: ctx.organizationId, projectId, zoneId: zoneId ?? null };
  const documents = withEditorDocuments(ctx);
  const source = await documents.load(scope);
  if (continuationId && source.authority === 'v2') {
    try { autoGenerate = { interiorRooms: false, continuation: await loadRenderBatchContinuation(ctx, scope, source.document, continuationId) }; }
    catch (error) {
      if (!(error instanceof UserFacingError)) throw error;
      autoGenerate = { interiorRooms: false, error: error.message };
    }
  }
  const approvalHistory = source.authority === 'v2' ? await documents.listApprovals(scope) : [];
  if (approvedId && !approvalHistory.some((entry) => entry.id === approvedId)) notFound();
  const selectedApprovalId = approvedId ?? approvalHistory[0]?.id;
  const approvedDesign = selectedApprovalId ? await documents.readApproval(scope, selectedApprovalId) : null;
  const conversion = source.authority === 'legacy' && source.legacySnapshot !== null
    ? fromCanvasV1(source.legacySnapshot)
    : null;
  let reference: PlanReference | null = null;
  if (!zoneId && source.authority === 'v2') {
    const studio = await loadStudio(ctx, projectId);
    const imported = studio.planImport;
    const image = imported?.image ?? studio.source;
    const background = studio.editorReference;
    // El fondo elegido o fijado al enviar al editor manda; otra extracción o una captura del editor no lo cambian.
    if (background?.image.assetUrl) {
      reference = { imageUrl: background.image.assetUrl, widthMm: background.frame.width, heightMm: background.frame.height,
        xMm: background.frame.x, yMm: background.frame.y };
    // Proyectos anteriores: la imagen de la última extracción, salvo que sea una captura del propio editor.
    // Guardar otra revisión no elimina la imagen de referencia del proyecto.
    // Mostrarla no aplica la importación ni sustituye el documento del Editor.
    } else if (imported && image?.assetUrl && !(studio.sourceKind === 'canvas' && image.assetKey === studio.plan?.assetKey)) {
      try {
        const frame = buildPlanImport(imported.raw, {
          generalWidthMm: imported.generalWidthMm,
          roomOverrides: imported.roomOverrides,
          doorOverrides: imported.doorOverrides,
          wallOverrides: imported.wallOverrides,
          includeFurniture: false,
          normalize: imported.detected ? {
            wallsOverride: imported.detected.walls,
            imageHeightOverWidth: imported.detected.heightOverWidth,
          } : {},
        }).sourceFrameMm;
        if (frame) reference = { imageUrl: image.assetUrl, widthMm: frame.width, heightMm: frame.height };
      } catch { /* Una extracción antigua inválida no impide abrir el editor. */ }
    }
  }

  if (source.authority === 'v2' && source.document.renderBackdrop) {
    const backdrop = source.document.renderBackdrop;
    const row = (await withOrg(ctx).deliverables.list(projectId)).find(item => item.id === backdrop.deliverableId
      && item.type === 'RENDER_3D' && (item.zoneId ?? null) === (zoneId ?? null));
    const imageUrl = row ? await resolveRenderUrl(row.payload as { assetKey?: string; assetUrl?: string }) : null;
    if (imageUrl) reference = { imageUrl, widthMm: backdrop.widthMm, heightMm: backdrop.heightMm, xMm: backdrop.xMm, yMm: backdrop.yMm };
  }
  return (
    <ProjectEditor
      key={JSON.stringify(scope)}
      scope={scope}
      projectName={project.title}
      autoGenerate={autoGenerate ?? null}
      initial={source.authority === 'v2' ? source.document : conversion?.document ?? emptyEditorDocument()}
      approvedDesign={approvedDesign}
      autoOpenApproved={Boolean(approvedId)}
      reference={reference}
      writable={source.authority === 'v2' && source.writable}
      migration={source.authority === 'legacy' ? {
        fingerprint: source.legacyFingerprint,
        complete: source.legacySnapshot === null || conversion?.complete === true,
        issues: conversion?.issues ?? [],
      } : null}
    />
  );
}
