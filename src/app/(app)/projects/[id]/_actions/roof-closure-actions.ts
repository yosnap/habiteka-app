'use server';

/**
 * Cierra con la cubierta del modelo una isométrica o un dron ya aceptados. El tejado no se diseña con IA: su forma sale
 * de una maqueta del plano vista desde la cámara de la imagen y sus datos, del panel Tejado. La IA lo añade a la imagen
 * aceptada alineándolo con sus muros, y una revisión comprueba cubierta, encuadre e identidad del resto. La imagen
 * resultante es un entregable nuevo de la misma tanda, pendiente de que el usuario la acepte.
 */
import { revalidatePath } from 'next/cache';
import sharp from 'sharp';
import { requireOrgContext } from '@/server/auth/require-org-context';
import { withOrg } from '@/server/db/scoped-repo';
import { prisma } from '@/server/db/prisma';
import { runAction, fail } from '@/server/errors/run-action';
import { assertConsent } from '@/server/privacy/consent-service';
import { assertTosAccepted } from '@/server/legal/tos-acceptance-service';
import { withEditorDocuments } from '@/server/editor/document-repo';
import { sameVisualDesignContent } from '@/server/walkthrough/tour-images';
import { getChatVisionAdapter, getImageAdapterForAction } from '@/server/ai';
import { getStorageAdapter } from '@/server/storage/s3-storage-adapter';
import { sanitizeOwnRenderBuffer } from '@/server/ai/image/input-sanitizer';
import { persistDeliverables } from '@/server/agent/persistence/deliverable-repo';
import { DELIVERABLE_LEGAL_SEAL } from '@/server/agent/legal/seal';
import { readRenderBytes, readRenderReference } from '@/server/agent/editor-v2/render-asset-reader';
import { projectRoofModel, roofModelGuidePng } from '@/server/agent/editor-v2/roof-closure-projection';
import { roofClosurePrompt, roofClosureReport, roofClosureReviewPrompt, ROOF_CLOSURE_PROMPT_VERSION, ROOF_REVIEW_SCHEMA } from '@/server/agent/editor-v2/roof-closure-prompt';
import { unfinishedRenderReview } from '@/server/agent/editor-v2/review-render-fidelity';
import { englishImagePrompt } from '@/server/agent/editor-v2/english-image-prompt';
import { fittedOutputRatio } from '@/server/agent/editor-v2/render-reference-frame';
import { acceptedRenderIssue } from '@/lib/editor-document/render-review';
import { renderViewSchema } from '@/lib/editor-document/render-view';
import { isInteriorRenderMode, renderDesignOptionsSchema, zoneCompositeActive } from '@/lib/editor-document/render-design-options';
import type { Deliverable } from '@/lib/contracts';
import type { EditorDocument } from '@/lib/editor-document/schema';

type RenderPayload = Extract<Deliverable['payload'], { type: 'render3d' }>;
const ROOF_PRESETS = new Set(['isometric', 'drone']);
/** Una pulsación repetida mientras se retoca no debe pagar otro retoque de la misma vista. */
const closing = new Set<string>();

/** La cubierta puede haber cambiado desde la imagen; el resto del inmueble debe ser el mismo que se generó. */
function withoutRoof(document: EditorDocument): EditorDocument {
  const copy = { ...document, revision: 0 };
  delete copy.exteriorRoof;
  return copy;
}

async function closeRoofFromModelImpl(projectId: string, zoneId: string | null, deliverableId: string) {
  const ctx = await requireOrgContext();
  if (!(await withOrg(ctx).projects.findById(projectId))) fail('Proyecto no encontrado en tu organización');
  if (zoneId && !(await withOrg(ctx).zones.list(projectId)).some((zone) => zone.id === zoneId)) fail('Zona no encontrada en el proyecto');
  await assertConsent(ctx.userId, 'IMAGE_PROCESSING');
  await assertTosAccepted(ctx.userId);
  const row = await prisma.deliverable.findFirst({ where: { id: deliverableId, projectId, zoneId, type: 'RENDER_3D', deletedAt: null,
    project: { organizationId: ctx.organizationId } }, select: { payload: true } });
  if (!row) fail('La imagen elegida no está disponible en este proyecto.');
  const payload = row.payload as unknown as RenderPayload, generation = payload.generation;
  const acceptance = acceptedRenderIssue(generation);
  if (acceptance) fail(`Acepta primero esta imagen: ${acceptance}`);
  const view = renderViewSchema.safeParse(generation?.view);
  if (!view.success || !ROOF_PRESETS.has(view.data.preset)) fail('El tejado se cierra sobre una isométrica o un dron aceptados.');
  const options = renderDesignOptionsSchema.parse(generation?.options ?? {});
  if (isInteriorRenderMode(options) || zoneCompositeActive(options))
    fail('El tejado se cierra sobre imágenes de toda la planta, no de zonas o interiores.');
  if (!generation?.documentRevision) fail('La imagen no indica de qué versión del plano procede. Genérala de nuevo.');

  const scope = { projectId, zoneId }, repo = withEditorDocuments(ctx);
  const current = await repo.load(scope);
  if (current.authority !== 'v2') fail('El plano todavía no usa el editor actual.');
  const document = current.document;
  if (!document.exteriorRoof) fail('Este plano no tiene cubierta. Defínela en Exterior › Tejado antes de cerrarla.');
  const source = await repo.readRevision(scope, generation.documentRevision);
  if (!sameVisualDesignContent(withoutRoof(source), withoutRoof(document)))
    fail('El plano cambió desde esta imagen (muros, huecos o muebles). Genera de nuevo la isométrica o el dron antes de cerrar el tejado.');

  const existing = await prisma.deliverable.findFirst({ where: { projectId, zoneId, type: 'RENDER_3D', deletedAt: null,
    payload: { path: ['generation', 'roofClosure', 'baseDeliverableId'], equals: deliverableId } }, select: { id: true } });
  if (existing) fail('Esta vista ya tiene su imagen con tejado en la tanda. Ábrela para revisarla; si no te convence, elimínala antes de repetir el cierre.');

  const base = await readRenderReference(payload);
  const { width, height } = await sharp(Buffer.from(base.base64, 'base64')).metadata();
  if (!width || !height) fail('No se pudo leer la imagen aceptada.');
  const guide = await roofModelGuidePng(projectRoofModel(document, view.data, width, height), document.exteriorRoof.color, width, height);
  const guideImage = { base64: guide.toString('base64'), mimeType: 'image/png' };

  const id = `del-${projectId}-render3d-${globalThis.crypto.randomUUID()}`;
  const scopeCtx = { organizationId: ctx.organizationId, userId: ctx.userId, projectId, refId: id, batchId: generation.batchId };
  const vision = await getChatVisionAdapter(scopeCtx, 'vision');
  // El generador recibe la petición en inglés; si la traducción falla, en español.
  const { prompt } = await englishImagePrompt(vision, roofClosurePrompt(document));
  const result = await (await getImageAdapterForAction(scopeCtx, 'render3d')).generate({ prompt, compactPrompt: prompt,
    aspectRatio: fittedOutputRatio(width / height)[0], referenceImages: [{ base64: base.base64, mimeType: base.mimeType }, guideImage] });
  const downloaded = await readRenderBytes(result);
  const candidate = await sanitizeOwnRenderBuffer(downloaded.raw);
  let asset = { assetUrl: result.assetUrl, assetKey: result.assetKey };
  if (!asset.assetKey) {
    // La URL del proveedor caduca: la imagen ya pagada se conserva en el almacenamiento del proyecto.
    const key = `renders/kie/${globalThis.crypto.randomUUID()}.${downloaded.contentType.includes('jpeg') ? 'jpg' : 'png'}`;
    await getStorageAdapter().put({ key, body: downloaded.raw, contentType: downloaded.contentType });
    asset = { assetUrl: await getStorageAdapter().getPresignedDownloadUrl(key), assetKey: key };
  }
  const review = await vision.chat({ model: '', responseSchema: ROOF_REVIEW_SCHEMA, temperature: 0, maxTokens: 2000, reasoning: { effort: 'low' },
    messages: [{ role: 'user', content: [{ type: 'text', text: roofClosureReviewPrompt(document) },
      { type: 'image_url', base64: base.base64, mimeType: base.mimeType }, { type: 'image_url', ...guideImage },
      { type: 'image_url', base64: candidate.base64, mimeType: candidate.mimeType }] }] })
    .then(answer => {
      const fidelity = roofClosureReport(answer.structured, answer.execution?.model);
      return fidelity.status === 'rejected' ? { fidelity, review: { status: 'rejected' as const, reviewedAt: fidelity.checkedAt,
        reason: `La imagen con tejado no superó la revisión: ${fidelity.violations!.join(' ')}` } } : { fidelity };
    })
    .catch(unfinishedRenderReview);
  const closedView = { ...view.data, ceilingView: 'solid' as const, cutaway: false, cutawayWallIds: [], cutawayObjectIds: [] };
  // La imagen nueva no hereda la revisión ni la aceptación de la base: el usuario la revisa de nuevo.
  const inherited = { ...generation };
  delete inherited.fidelity; delete inherited.review; delete inherited.acceptance;
  await persistDeliverables(projectId, [{
    id, type: 'render3d',
    payload: { type: 'render3d', assetUrl: asset.assetUrl, ...(asset.assetKey ? { assetKey: asset.assetKey } : {}),
      ...(payload.camera ? { camera: payload.camera } : {}),
      generation: { ...inherited, ...(result.generation ?? {}), ...review, promptVersion: ROOF_CLOSURE_PROMPT_VERSION, view: closedView,
        documentRevision: document.revision, referenceDesignId: deliverableId, roofClosure: { baseDeliverableId: deliverableId } } },
    legalSeal: DELIVERABLE_LEGAL_SEAL,
    version: 1,
  }], undefined, zoneId, { allowEditorV2: true });
  revalidatePath(`/projects/${projectId}/deliverables`);
  revalidatePath(`/projects/${projectId}/historial`);
  return { id, assetUrl: asset.assetUrl };
}

export async function closeRoofFromModel(projectId: string, zoneId: string | null, deliverableId: string) {
  return runAction(async () => {
    if (closing.has(deliverableId)) fail('El tejado de esta vista ya se está cerrando. Espera a que termine.');
    closing.add(deliverableId);
    try { return await closeRoofFromModelImpl(projectId, zoneId, deliverableId); }
    finally { closing.delete(deliverableId); }
  });
}
