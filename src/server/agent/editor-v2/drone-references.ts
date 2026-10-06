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
import { acceptedRenderIssue, renderReviewIssue } from '@/lib/editor-document/render-review';
import { referenceSettingIssues, referenceAcceptanceIssue, type ReferenceGeneration } from '@/lib/editor-document/render-reference-compatibility';

/**
 * Vista auditada del mismo diseño, ámbito, luz, libertad y permiso de rediseño. Las aceptadas por el usuario tienen
 * prioridad; con `requireAccepted` solo valen ellas.
 */
async function designReference(ctx: OrgContext, scope: EditorScope, document: EditorDocument, view: RenderView,
  options: RenderDesignOptions, preset: 'top' | 'isometric', requireAccepted: boolean, referenceId?: string) {
  const rows = await prisma.deliverable.findMany({ where: { projectId: scope.projectId,
    zoneId: scope.zoneId ?? null, project: { organizationId: ctx.organizationId }, type: 'RENDER_3D', deletedAt: null,
    ...(referenceId ? { id: referenceId } : {}),
    OR: [{ payload: { path: ['generation', 'view', 'preset'], equals: preset } }] },
    select: { id: true, payload: true }, orderBy: { createdAt: 'desc' }, take: 200 });
  if (referenceId && !rows.some(row => row.id === referenceId)) fail('La referencia elegida no está disponible en este proyecto y zona para esta vista. Vuelve a abrir la biblioteca.');
  const candidates = rows.flatMap((row) => {
    if (referenceId && row.id !== referenceId) return [];
    const payload = row.payload as { assetKey?: string; assetUrl?: string; generation?: ReferenceGeneration };
    const generation = payload?.generation;
    const issues = [...referenceSettingIssues(generation, view, options), ...(requireAccepted ? [referenceAcceptanceIssue(generation)].filter(Boolean) : [])];
    if (referenceId && issues.length) fail(`La referencia elegida no es compatible: ${issues.join(' ')}`);
    if (renderReviewIssue(generation)) return [];
    const accepted = !acceptedRenderIssue(generation);
    if (requireAccepted && !accepted) return [];
    return generation?.documentRevision && !issues.length
      ? [{ ...row, payload, revision: generation.documentRevision, accepted }] : [];
  });
  const valid = new Set(await sameContentRevisions(ctx, scope, { document, revision: document.revision }, candidates.map((row) => row.revision)));
  if (referenceId && !candidates.some(row => valid.has(row.revision))) fail('El plano ha cambiado respecto a la referencia elegida. Selecciona un diseño compatible con el plano actual.');
  // Orden estable: dentro de cada grupo se conserva la más reciente primero.
  return candidates.filter((row) => valid.has(row.revision)).sort((a, b) => Number(b.accepted) - Number(a.accepted))[0];
}

const LATERAL_PRESETS = Object.keys(LATERAL_ROTATION);

/**
 * Los laterales enseñan el interiorismo de la cenital aceptada desde otra cámara. Sin ella cada ángulo inventaba su
 * propio mobiliario y la tanda no servía para un mismo vídeo.
 */
export async function lateralDesignReference(ctx: OrgContext, scope: EditorScope, document: EditorDocument,
  view: RenderView, options: RenderDesignOptions, referenceId?: string) {
  if (!LATERAL_PRESETS.includes(view.preset) || isInteriorRenderMode(options)) return null;
  const anchor = await designReference(ctx, scope, document, view, options, 'top', true, referenceId);
  if (!anchor) fail('Falta una cenital aceptada del mismo diseño, ámbito, luz, libertad y permiso de rediseño. Abre Elegir de la biblioteca, revisa tu cenital y pulsa Aceptar este diseño. Usa los mismos ajustes antes de preparar frontal, trasera y laterales.');
  // Sin girar ni recortar: `acceptedTopForView` la adapta a la cámara cuando se conocen las estancias que ve.
  return { identity: await readRenderReference(anchor.payload), deliverableId: anchor.id };
}

/** El dron deriva de una vista cercana aceptada del mismo inmueble y de su entorno real. */
export async function droneReferences(ctx: OrgContext, scope: EditorScope, document: EditorDocument,
  view: RenderView, options: RenderDesignOptions, orthophotoDataUrl?: string, referenceId?: string) {
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
  const anchor = await designReference(ctx, scope, document, view, options, view.preset === 'drone' ? 'isometric' : 'top', true, referenceId);
  if (!anchor) fail(`Falta una ${view.preset === 'drone' ? 'isométrica' : 'cenital'} aceptada del mismo diseño, ámbito, luz, libertad y permiso de rediseño. Elígela de la biblioteca o genérala y acéptala antes de la vista lejana.`);
  return { identity: await readRenderReference(anchor.payload), environment, deliverableId: anchor.id };
}
