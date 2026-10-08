'use server';

/**
 * Vuelve a revisar una cenital descartada sin generar otra imagen ni descargarla: la revisión compara la imagen guardada
 * con el plano de la misma revisión, igual que al generarla, y actualiza su informe. Si la supera, queda pendiente de que
 * el usuario la acepte; la revisión automática nunca acepta por él.
 */
import { revalidatePath } from 'next/cache';
import { requireOrgContext } from '@/server/auth/require-org-context';
import { withOrg } from '@/server/db/scoped-repo';
import { prisma } from '@/server/db/prisma';
import { runAction, fail } from '@/server/errors/run-action';
import { assertConsent } from '@/server/privacy/consent-service';
import { assertTosAccepted } from '@/server/legal/tos-acceptance-service';
import { withEditorDocuments } from '@/server/editor/document-repo';
import { sameVisualDesignContent } from '@/server/walkthrough/tour-images';
import { getChatVisionAdapter } from '@/server/ai';
import { sanitizeOwnRenderBuffer } from '@/server/ai/image/input-sanitizer';
import { readRenderBytes } from '@/server/agent/editor-v2/render-asset-reader';
import { renderDrawingReferences } from '@/server/agent/editor-v2/render-drawing-references';
import { renderSpatialReference } from '@/server/agent/editor-v2/render-spatial-reference';
import { fitRenderReferenceAspect } from '@/server/agent/editor-v2/render-reference-frame';
import { projectVehicleCount } from '@/server/agent/editor-v2/selected-view-image-prompt';
import { reviewRenderFidelity, unfinishedRenderReview } from '@/server/agent/editor-v2/review-render-fidelity';
import { rereviewableRender } from '@/lib/editor-document/render-rereview';
import { requestedRenderRedesign } from '@/lib/editor-document/render-redesign';
import { renderViewSchema } from '@/lib/editor-document/render-view';
import { renderDesignOptionsSchema } from '@/lib/editor-document/render-design-options';
import { lateralDesignReference } from '@/server/agent/editor-v2/drone-references';
import { prepareRenderImageRequest } from '@/server/agent/editor-v2/prepare-render-image-request';
import { sectionFurnitureBrief } from '@/server/agent/editor-v2/section-furniture-brief';
import type { OrgContext } from '@/server/auth/org-context';
import type { EditorScope } from '@/server/editor/authority';
import type { EditorDocument } from '@/lib/editor-document/schema';
import type { RenderView } from '@/lib/editor-document/render-view';
import type { RenderDesignOptions } from '@/lib/editor-document/render-design-options';
import type { ChatVisionAdapter, Deliverable } from '@/lib/contracts';

type RenderPayload = Extract<Deliverable['payload'], { type: 'render3d' }>;
/** Una pulsación repetida mientras se revisa no debe pagar otra revisión de la misma imagen. */
const reviewing = new Set<string>();

async function rereviewRenderDesignImpl(projectId: string, zoneId: string | null, deliverableId: string) {
  const ctx = await requireOrgContext();
  if (!(await withOrg(ctx).projects.findById(projectId))) fail('Proyecto no encontrado en tu organización');
  if (zoneId && !(await withOrg(ctx).zones.list(projectId)).some((zone) => zone.id === zoneId)) fail('Zona no encontrada en el proyecto');
  await assertConsent(ctx.userId, 'IMAGE_PROCESSING');
  await assertTosAccepted(ctx.userId);
  const row = await prisma.deliverable.findFirst({ where: { id: deliverableId, projectId, zoneId, type: 'RENDER_3D', deletedAt: null,
    project: { organizationId: ctx.organizationId } }, select: { payload: true, version: true } });
  if (!row) fail('La imagen elegida no está disponible en este proyecto.');
  const payload = row.payload as unknown as RenderPayload, generation = payload.generation;
  if (!generation || !rereviewableRender(payload))
    fail('Solo se pueden volver a revisar cenitales, frontales, traseras y laterales de toda la planta descartadas por la revisión automática.');
  const view = renderViewSchema.parse(generation.view), options = renderDesignOptionsSchema.parse(generation.options ?? {});

  const scope = { projectId, zoneId }, repo = withEditorDocuments(ctx);
  const current = await repo.load(scope);
  if (current.authority !== 'v2') fail('El plano todavía no usa el editor actual.');
  const document = await repo.readRevision(scope, generation.documentRevision);
  if (!sameVisualDesignContent(document, current.document))
    fail('El plano cambió desde esta imagen (muros, huecos o muebles). Genera una cenital nueva.');

  if (reviewing.has(deliverableId)) fail('Esta imagen ya se está revisando.');
  reviewing.add(deliverableId);
  try {
    const candidate = await sanitizeOwnRenderBuffer((await readRenderBytes(payload)).raw);
    const spatial = await renderSpatialReference(document, view, options);
    const vision = await getChatVisionAdapter({ organizationId: ctx.organizationId, userId: ctx.userId, projectId,
      refId: deliverableId, batchId: generation.batchId }, 'vision');
    const references = view.preset === 'top' ? await planReferences(document, view, options)
      : await sectionReferences(ctx, scope, document, view, options, generation.referenceDesignId, spatial, vision);
    const result: { fidelity?: NonNullable<RenderPayload['generation']>['fidelity']; review?: NonNullable<RenderPayload['generation']>['review'] } =
      await reviewRenderFidelity(vision, references.reference, candidate, view, undefined, projectVehicleCount(document),
        options.freedom === 'strict', references.lateral, options.redesignFixed, !references.lateral && requestedRenderRedesign(options, '', ''), spatial,
        { people: options.people, ...references.extra })
        .catch(unfinishedRenderReview);
    // El informe nuevo sustituye al anterior; sin descarte, la imagen queda pendiente de aceptación.
    const next = { ...generation, ...result };
    if (!result.review) delete next.review;
    if (!result.fidelity) delete next.fidelity;
    const updated = await prisma.deliverable.updateMany({ where: { id: deliverableId, version: row.version, deletedAt: null },
      data: { payload: JSON.parse(JSON.stringify({ ...payload, generation: next })), version: { increment: 1 } } });
    if (updated.count !== 1) fail('La imagen ha cambiado mientras se revisaba. Recarga Diseños.');
    revalidatePath(`/projects/${projectId}/deliverables`);
    return { passed: !result.review, reason: result.review?.reason ?? null, version: row.version + 1 };
  } finally {
    reviewing.delete(deliverableId);
  }
}

/** La cenital se revisa contra el plano de su revisión, igual que al generarla. */
async function planReferences(document: EditorDocument, view: RenderView, options: RenderDesignOptions) {
  const { plan } = await renderDrawingReferences(document, view, options, false, false);
  if (!plan) fail('No se pudo preparar el plano de referencia de esta cenital.');
  const { image } = await fitRenderReferenceAspect(plan);
  return { reference: image, lateral: undefined, extra: { reference: 'plan' as const } };
}

/**
 * Frontal, trasera y laterales se revisan como al generarse: su sección, la cenital aceptada que usaron (recortada y
 * girada como la cámara) y la lectura de su mobiliario, que confirma las camas y sofás dibujados. Esa lectura tiene un
 * pequeño coste de visión; el prompt que también prepara no se usa.
 */
async function sectionReferences(ctx: OrgContext, scope: EditorScope, document: EditorDocument, view: RenderView, options: RenderDesignOptions,
  referenceDesignId: string | undefined, spatial: Awaited<ReturnType<typeof renderSpatialReference>>, vision: ChatVisionAdapter) {
  const lateral = await lateralDesignReference(ctx, scope, document, view, options, referenceDesignId);
  const { section } = await renderDrawingReferences(document, view, options, Boolean(lateral), false);
  if (!lateral || !section) fail('No se pudo preparar la sección de referencia de esta vista.');
  const prepared = await prepareRenderImageRequest({ document, view, style: 'moderno', options, objective: '', instruction: '',
    reference: section.image, styleAnchor: lateral.identity, acceptedDesign: true, spatial,
    section: { ...section, describe: (top, names, hints) => sectionFurnitureBrief(vision, top, names, hints) } });
  if (!('sectionRooms' in prepared) || !prepared.styleAnchor) fail('No se pudo preparar la sección de referencia de esta vista.');
  return { reference: prepared.reference, lateral: { identity: prepared.styleAnchor, lateral: true },
    extra: { reference: 'section' as const, sectionRooms: prepared.sectionRooms, sectionFurniture: prepared.sectionFurniture } };
}

export async function rereviewRenderDesign(projectId: string, zoneId: string | null, deliverableId: string) {
  return runAction(() => rereviewRenderDesignImpl(projectId, zoneId, deliverableId));
}
