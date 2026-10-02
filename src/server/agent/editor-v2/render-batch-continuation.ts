import 'server-only';
import { z } from 'zod';
import { prisma } from '@/server/db/prisma';
import type { OrgContext } from '@/server/auth/org-context';
import type { EditorScope } from '@/server/editor/authority';
import type { EditorDocument } from '@/lib/editor-document/schema';
import type { Deliverable } from '@/lib/contracts';
import { renderDesignOptionsSchema, renderBatchSettingsKey as settingsKey, type RenderDesignOptions } from '@/lib/editor-document/render-design-options';
import { renderViewIntegrityIssue } from '@/lib/editor-document/render-view-integrity';
import { renderReviewIssue } from '@/lib/editor-document/render-review';
import { sameContentRevisions } from '@/server/walkthrough/tour-images';
import { fail } from '@/server/errors/run-action';

type Payload = Extract<Deliverable['payload'], { type: 'render3d' }>;

async function compatibleBatch(ctx: OrgContext, scope: EditorScope, document: EditorDocument, batchId: string) {
  if (!z.string().uuid().safeParse(batchId).success) fail('La tanda no es válida.');
  const rows = await prisma.deliverable.findMany({ where: { projectId: scope.projectId, zoneId: scope.zoneId ?? null,
    project: { organizationId: ctx.organizationId, deletedAt: null }, type: 'RENDER_3D', deletedAt: null,
    payload: { path: ['generation', 'batchId'], equals: batchId } }, select: { payload: true }, orderBy: { createdAt: 'asc' } });
  const renders = rows.map(row => {
    const payload = row.payload as unknown as Payload;
    if (!payload || typeof payload !== 'object') fail('Esta tanda no conserva los ajustes necesarios. Prepara una nueva.');
    const options = renderDesignOptionsSchema.safeParse(payload.generation?.options);
    if (payload.type !== 'render3d' || !options.success || !payload.generation?.documentRevision
      || !payload.generation.provider || payload.generation.provider === 'native')
      fail('Esta tanda no conserva los ajustes necesarios. Prepara una nueva.');
    return { payload, options: options.data, revision: payload.generation.documentRevision };
  });
  if (!renders.length) return renders;
  const valid = new Set(await sameContentRevisions(ctx, scope, { document, revision: document.revision }, renders.map(row => row.revision)));
  if (renders.some(row => !valid.has(row.revision))) fail('El diseño cambió desde esta tanda. Prepara una nueva con el diseño actual.');
  if (renders.some(row => settingsKey(row.options) !== settingsKey(renders[0]!.options)))
    fail('Esta tanda mezcla ajustes distintos. Prepara una nueva.');
  return renders;
}

/** Recupera ajustes y conserva la tanda; no llama a IA ni reconstruye imágenes descartadas. */
export async function loadRenderBatchContinuation(ctx: OrgContext, scope: EditorScope, document: EditorDocument, batchId: string) {
  const rows = await compatibleBatch(ctx, scope, document, batchId), first = rows[0];
  if (!first) fail('No se encontró esta tanda en el inmueble.');
  if (first.options.interiorRoomIds.length || first.options.views.includes('current'))
    fail('Completar vistas admite tandas de ángulos generales. Prepara las cámaras interiores o actuales de nuevo.');
  const completedViews = [...new Set(rows.flatMap(row => {
    const generation = row.payload.generation!;
    return renderReviewIssue(generation) || renderViewIntegrityIssue(document, generation.view)
      ? [] : generation.view ? [generation.view.preset] : [];
  }))];
  const requested = [...new Set(rows.flatMap(row => row.options.views))];
  const completed = new Set<string>(completedViews);
  const views = requested.filter(view => !completed.has(view));
  if (!views.length) fail('Las vistas de esta tanda ya están completas.');
  return { batchId, options: { ...first.options, views }, completedViews };
}

/** Un ID compartido no permite mezclar ámbitos, luces o revisiones al añadir imágenes. */
export async function assertRenderBatchCompatible(ctx: OrgContext, scope: EditorScope, document: EditorDocument,
  batchId: string | undefined, options: RenderDesignOptions) {
  if (!batchId) return;
  const rows = await compatibleBatch(ctx, scope, document, batchId);
  if (rows.some(row => settingsKey(row.options) !== settingsKey(options)))
    fail('Los ajustes cambiaron. Prepara una nueva tanda para este ámbito, luz o diseño.');
}
