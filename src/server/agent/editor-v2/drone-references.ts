import 'server-only';
import { prisma } from '@/server/db/prisma';
import type { OrgContext } from '@/server/auth/org-context';
import type { EditorScope } from '@/server/editor/authority';
import type { EditorDocument } from '@/lib/editor-document/schema';
import type { RenderView } from '@/lib/editor-document/render-view';
import { zoneCompositeActive, type RenderDesignOptions } from '@/lib/editor-document/render-design-options';
import { sameContentRevisions } from '@/server/walkthrough/tour-images';
import { sanitizeImageBuffer } from '@/server/ai/image/input-sanitizer';
import { readRenderReference } from './render-asset-reader';
import { fail } from '@/server/errors/run-action';
import { getStorageAdapter } from '@/server/storage/s3-storage-adapter';
import { assertGeographicSiteOwnership } from '@/server/editor/geographic-site-ownership';
import { renderReviewIssue, type RenderReview } from '@/lib/editor-document/render-review';

/** El dron deriva de una vista cercana auditada del mismo inmueble y de su entorno real. */
export async function droneReferences(ctx: OrgContext, scope: EditorScope, document: EditorDocument,
  view: RenderView, options: RenderDesignOptions, orthophotoDataUrl?: string) {
  if (!['drone', 'isometric', 'exterior'].includes(view.preset)) return null;
  const isolated = zoneCompositeActive(options);
  if (!isolated && document.geographicSite?.confirmed) {
    assertGeographicSiteOwnership(document, ctx, scope.projectId);
    const bytes = await getStorageAdapter().get(document.geographicSite.assetKey);
    // El encaje confirmado fija la parcela; una carga manual no puede sustituir su entorno.
    orthophotoDataUrl = `data:image/jpeg;base64,${bytes.toString('base64')}`;
  }
  const match = orthophotoDataUrl?.match(/^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!isolated && (!match?.[1] || orthophotoDataUrl!.length > 14_000_000))
    fail('Para las vistas lejanas adjunta una ortofoto de la parcela y genera antes una cenital del mismo diseño.');
  const environment = isolated ? undefined : await sanitizeImageBuffer(Buffer.from(match![1]!, 'base64'));
  const rows = await prisma.deliverable.findMany({ where: { projectId: scope.projectId,
    zoneId: scope.zoneId ?? null, project: { organizationId: ctx.organizationId }, type: 'RENDER_3D', deletedAt: null,
    OR: (view.preset === 'drone' ? ['isometric'] : ['top']).map((preset) => ({ payload: { path: ['generation', 'view', 'preset'], equals: preset } })) },
    select: { id: true, payload: true }, orderBy: { createdAt: 'desc' }, take: 32 });
  const candidates = rows.flatMap((row) => {
    const payload = row.payload as { assetKey?: string; assetUrl?: string; generation?: {
      documentRevision?: number; review?: RenderReview; view?: { preset?: string; allLevels?: boolean; lighting?: string; levelId?: string | null }; options?: { freedom?: string; placement?: string; regions?: unknown[]; designScope?: string; redesignFixed?: boolean } } };
    const generation = payload?.generation;
    if (renderReviewIssue(generation)) return [];
    return generation?.documentRevision && generation.view?.lighting === options.lighting &&
      (generation.view.levelId ?? null) === (view.levelId ?? null) && generation.options?.freedom === options.freedom &&
      (generation.view.allLevels === true) === (view.allLevels === true) &&
      (generation.options.redesignFixed === true) === options.redesignFixed &&
      (generation.options.placement === 'selected') === (options.placement === 'selected') &&
      (options.placement !== 'selected' || JSON.stringify(generation.options.regions) === JSON.stringify(options.regions)) &&
      (generation.options.designScope === 'house') === (options.designScope === 'house')
      ? [{ ...row, payload, revision: generation.documentRevision }] : [];
  });
  const valid = new Set(await sameContentRevisions(ctx, scope, { document, revision: document.revision }, candidates.map((row) => row.revision)));
  const compatible = candidates.filter((row) => valid.has(row.revision));
  const anchor = compatible[0];
  if (!anchor) fail(`Falta una ${view.preset === 'drone' ? 'isométrica' : 'cenital'} auditada del mismo diseño, ámbito, luz, libertad y permiso de rediseño. Genérala antes de la vista lejana.`);
  return { identity: await readRenderReference(anchor.payload), environment, deliverableId: anchor.id };
}
