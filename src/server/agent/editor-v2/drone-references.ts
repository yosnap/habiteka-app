import 'server-only';
import { prisma } from '@/server/db/prisma';
import type { OrgContext } from '@/server/auth/org-context';
import type { EditorScope } from '@/server/editor/authority';
import type { EditorDocument } from '@/lib/editor-document/schema';
import type { RenderView } from '@/lib/editor-document/render-view';
import { isInteriorRenderMode, zoneCompositeActive, type RenderDesignOptions } from '@/lib/editor-document/render-design-options';
import { sameContentRevisions } from '@/server/walkthrough/tour-images';
import { sanitizeImageBuffer } from '@/server/ai/image/input-sanitizer';
import { readRenderReference } from './render-asset-reader';
import { LATERAL_ROTATION } from './accepted-top-reference';
import { fail } from '@/server/errors/run-action';
import { getStorageAdapter } from '@/server/storage/s3-storage-adapter';
import { assertGeographicSiteOwnership } from '@/server/editor/geographic-site-ownership';
import { acceptedRenderIssue, renderReviewIssue, type RenderReview } from '@/lib/editor-document/render-review';

type ReferenceGeneration = {
  provider?: string; documentRevision?: number; review?: RenderReview; fidelity?: { status: string };
  acceptance?: { acceptedAt: string; userId: string };
  view?: { preset?: string; allLevels?: boolean; lighting?: string; levelId?: string | null };
  options?: { freedom?: string; placement?: string; regions?: unknown[]; designScope?: string; redesignFixed?: boolean };
};

/**
 * Vista auditada del mismo diseño, ámbito, luz, libertad y permiso de rediseño. Las aceptadas por el usuario tienen
 * prioridad; con `requireAccepted` solo valen ellas.
 */
async function designReference(ctx: OrgContext, scope: EditorScope, document: EditorDocument, view: RenderView,
  options: RenderDesignOptions, preset: 'top' | 'isometric', requireAccepted: boolean) {
  const rows = await prisma.deliverable.findMany({ where: { projectId: scope.projectId,
    zoneId: scope.zoneId ?? null, project: { organizationId: ctx.organizationId }, type: 'RENDER_3D', deletedAt: null,
    OR: [{ payload: { path: ['generation', 'view', 'preset'], equals: preset } }] },
    select: { id: true, payload: true }, orderBy: { createdAt: 'desc' }, take: 32 });
  const candidates = rows.flatMap((row) => {
    const payload = row.payload as { assetKey?: string; assetUrl?: string; generation?: ReferenceGeneration };
    const generation = payload?.generation;
    if (renderReviewIssue(generation)) return [];
    const accepted = !acceptedRenderIssue(generation);
    if (requireAccepted && !accepted) return [];
    return generation?.documentRevision && generation.view?.lighting === options.lighting &&
      (generation.view.levelId ?? null) === (view.levelId ?? null) && generation.options?.freedom === options.freedom &&
      (generation.view.allLevels === true) === (view.allLevels === true) &&
      (generation.options.redesignFixed === true) === options.redesignFixed &&
      (generation.options.placement === 'selected') === (options.placement === 'selected') &&
      (options.placement !== 'selected' || JSON.stringify(generation.options.regions) === JSON.stringify(options.regions)) &&
      (generation.options.designScope === 'house') === (options.designScope === 'house')
      ? [{ ...row, payload, revision: generation.documentRevision, accepted }] : [];
  });
  const valid = new Set(await sameContentRevisions(ctx, scope, { document, revision: document.revision }, candidates.map((row) => row.revision)));
  // Orden estable: dentro de cada grupo se conserva la más reciente primero.
  return candidates.filter((row) => valid.has(row.revision)).sort((a, b) => Number(b.accepted) - Number(a.accepted))[0];
}

const LATERAL_PRESETS = Object.keys(LATERAL_ROTATION);

/**
 * Los laterales enseñan el interiorismo de la cenital aceptada desde otra cámara. Sin ella cada ángulo inventaba su
 * propio mobiliario y la tanda no servía para un mismo vídeo.
 */
export async function lateralDesignReference(ctx: OrgContext, scope: EditorScope, document: EditorDocument,
  view: RenderView, options: RenderDesignOptions) {
  if (!LATERAL_PRESETS.includes(view.preset) || isInteriorRenderMode(options)) return null;
  const anchor = await designReference(ctx, scope, document, view, options, 'top', true);
  if (!anchor) fail('Falta una cenital aceptada del mismo diseño, ámbito, luz, libertad y permiso de rediseño. Genera la cenital, acéptala en Diseños y prepara después las vistas frontal, trasera y laterales con los mismos ajustes.');
  // Sin girar ni recortar: `acceptedTopForView` la adapta a la cámara cuando se conocen las estancias que ve.
  return { identity: await readRenderReference(anchor.payload), deliverableId: anchor.id };
}

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
  const anchor = await designReference(ctx, scope, document, view, options, view.preset === 'drone' ? 'isometric' : 'top', false);
  if (!anchor) fail(`Falta una ${view.preset === 'drone' ? 'isométrica' : 'cenital'} auditada del mismo diseño, ámbito, luz, libertad y permiso de rediseño. Genérala antes de la vista lejana.`);
  return { identity: await readRenderReference(anchor.payload), environment, deliverableId: anchor.id };
}
