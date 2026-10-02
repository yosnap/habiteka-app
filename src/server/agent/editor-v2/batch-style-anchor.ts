import 'server-only';
import { prisma } from '@/server/db/prisma';
import { readRenderReference } from './render-asset-reader';
import { renderReviewIssue, type RenderReview } from '@/lib/editor-document/render-review';

/**
 * Primera imagen ya guardada del mismo lote de renders. Sirve de referencia de materiales y ambiente para las vistas
 * siguientes, de modo que no reinventen el diseño. La busca el servidor por lote y proyecto: el cliente no aporta la imagen.
 */
export async function findBatchStyleAnchor(projectId: string, batchId?: string) {
  if (!batchId) return null;
  const row = await prisma.deliverable.findFirst({
    where: { projectId, type: 'RENDER_3D', deletedAt: null, payload: { path: ['generation', 'batchId'], equals: batchId } },
    orderBy: { createdAt: 'asc' },
    select: { payload: true },
  });
  const payload = row?.payload as { assetKey?: unknown; assetUrl?: unknown; generation?: { review?: RenderReview } } | null | undefined;
  if (!payload || renderReviewIssue(payload.generation) || (!payload.assetKey && !payload.assetUrl)) return null;
  // Una ancla que no se puede leer no debe impedir generar la vista.
  try { return await readRenderReference(payload); } catch { return null; }
}
