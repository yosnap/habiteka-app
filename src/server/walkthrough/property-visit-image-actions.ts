'use server';
import { requireOrgContext } from '@/server/auth/require-org-context';
import { normalizeEditorScope, type EditorScope } from '@/server/editor/authority';
import { readPropertyVisit, updatePropertyVisit } from './property-visit-repo';
import { propertyVisitAnchors, propertyVisitSourceDocument } from './property-visit-sources';
import { renderViewSchema, type RenderCapture } from '@/lib/editor-document/render-view';
import { sameCameraPose } from '@/lib/contracts/storyboard-image';
import { cameraPoseFromView } from '@/lib/contracts/walkthrough-keyframe';
import { assertRenderViewIntegrity } from '@/lib/editor-document/render-view-integrity';
import { propertyVisitRoomContext } from '@/lib/editor-document/property-visit-room-context';
import { defaultRenderDesignOptions } from '@/lib/editor-document/render-design-options';
import { sanitizeImageBuffer, sanitizeOwnRenderBuffer } from '@/server/ai/image/input-sanitizer';
import { readRenderBytes, readRenderReference } from '@/server/agent/editor-v2/render-asset-reader';
import { renderSpatialReference } from '@/server/agent/editor-v2/render-spatial-reference';
import { prepareRenderImageRequest } from '@/server/agent/editor-v2/prepare-render-image-request';
import { interiorFurnitureBrief } from '@/server/agent/editor-v2/interior-furniture-brief';
import { cameraOpeningLocations, openingSightlineDepths } from '@/server/agent/editor-v2/accepted-interior-prompt';
import { getChatVisionAdapter, getImageAdapterForAction } from '@/server/ai';
import { reviewRenderFidelity, unfinishedRenderReview } from '@/server/agent/editor-v2/review-render-fidelity';
import { projectVehicleCount, SELECTED_VIEW_IMAGE_PROMPT_VERSION } from '@/server/agent/editor-v2/selected-view-image-prompt';
import { getStorageAdapter } from '@/server/storage/s3-storage-adapter';
import { persistDeliverables } from '@/server/agent/persistence/deliverable-repo';
import { DELIVERABLE_LEGAL_SEAL } from '@/lib/legal-text';
import { assertConsent } from '@/server/privacy/consent-service';
import { assertTosAccepted } from '@/server/legal/tos-acceptance-service';
import { assertEditorQuality } from '@/server/quality/editor-gate';
import { resolveRoutes } from '@/server/ai/model-routing';
import { allowedModel } from '@/server/admin/config/model-allowlist';
import { englishImagePrompt } from '@/server/agent/editor-v2/english-image-prompt';
import { assertPropertyVisitBudget } from './property-visit-budget';
import { propertyVisitCorrection } from './property-visit-correction';
import { validateVisitRegionEdit, visitRegionPrompt, type VisitRegionEdit } from './property-visit-region';

/** Una imagen por petición y un solo intento por encuadre. Nunca acepta el resultado automáticamente. */
export async function generatePropertyVisitImage(rawScope: EditorScope, id: string, imageId: string, capture: RenderCapture,
  consent: { generate: boolean; maxImageUsd: number; qualityAck: boolean }, regionEdit?: VisitRegionEdit) {
  const scope = normalizeEditorScope(rawScope), ctx = await requireOrgContext(), row = await readPropertyVisit(ctx, scope, id);
  const job = structuredClone(row.job), image = job.images.find(item => item.id === imageId);
  if (!image || image.state !== 'pending') throw new Error('Este encuadre ya se envió. Actualiza el paseo; no se volverá a cobrar automáticamente.');
  if (job.images.some(item => item.state === 'submitting')) throw new Error('Espera a la imagen en curso.');
  // No gastar en nuevas referencias de un paseo cuyo vídeo ya excede el límite completo.
  await assertPropertyVisitBudget(job);
  const route = (await resolveRoutes('render3d'))[0];
  const price = route && allowedModel('render3d', route.model, route.provider)?.priceUsdPerUnit;
  if (!consent.generate || !Number.isFinite(consent.maxImageUsd) || price === undefined || price > consent.maxImageUsd ||
    `${route?.provider}:${route?.model}` !== job.imageModel) throw new Error('Confirma el modelo y precio de esta imagen. Las revisiones IA se facturan aparte.');
  const document = await propertyVisitSourceDocument(ctx, scope, job), anchors = await propertyVisitAnchors(ctx, scope, job);
  const view = renderViewSchema.parse(capture.view);
  if (!sameCameraPose(cameraPoseFromView(view), image.frame.camera) || view.preset !== 'custom' || view.allLevels ||
    view.cutaway || view.ceilingView !== 'solid' || view.cutawayWallIds?.length || view.cutawayObjectIds?.length ||
    Math.abs(view.aspect - 16 / 9) > .02 || view.lighting !== job.lighting)
    throw new Error('La captura no coincide con el encuadre completo del paseo.');
  assertRenderViewIntegrity(document, view);
  const correction = await propertyVisitCorrection(ctx, scope, id, job, image);
  const edit = validateVisitRegionEdit(regionEdit, correction?.sourceId);
  const match = typeof capture.dataUrl === 'string' && capture.dataUrl.length <= 14_000_000
    ? /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(capture.dataUrl) : null;
  if (!match) throw new Error('Falta una captura PNG válida de la guía.');
  await assertConsent(ctx.userId, 'IMAGE_PROCESSING'); await assertTosAccepted(ctx.userId);
  // Reclamar antes de cualquier evaluación de pago. Un corte conserva la incertidumbre sin repetir gasto.
  image.state = 'submitting'; image.sourceId = `del-${scope.projectId}-visit-${crypto.randomUUID()}`;
  const version = await updatePropertyVisit(ctx, scope, id, row.version, job);
  let imageSubmitted = false;
  try {
    await assertEditorQuality(ctx, scope, document, consent.qualityAck, 'render_concepto');
    const context = propertyVisitRoomContext(document, image.frame);
    delete view.roomId; delete view.roomName; delete view.roomAreaM2; delete view.zones;
    if (context) Object.assign(view, context);
    const options = { ...defaultRenderDesignOptions(), lighting: job.lighting };
    const spatial = await renderSpatialReference(document, view, options);
    const attribution = { organizationId: ctx.organizationId, userId: ctx.userId, projectId: scope.projectId, refId: image.sourceId, batchId: id };
    const vision = await getChatVisionAdapter(attribution, 'vision');
    const identity = await readRenderReference(anchors[0]!.payload);
    const exterior = await readRenderReference(anchors[1]!.payload);
    const prepared = await prepareRenderImageRequest({ document, view, style: 'moderno', options,
      objective: 'Paseo continuo del inmueble desde sus diseños aceptados',
      instruction: 'Reproduce exclusivamente el diseño aceptado, sin rediseñar. Arquitectura y cámara de la guía; materiales, colores y mobiliario del diseño. Las puertas del recorrido están abiertas. No inventes espacios fuera del proyecto.',
      reference: await sanitizeImageBuffer(Buffer.from(match[1]!, 'base64')), spatial, styleAnchor: identity, acceptedDesign: true,
      describeInterior: top => interiorFurnitureBrief(vision, top, view, spatial.context) });
    // La segunda referencia aporta únicamente fachadas y cubierta; nunca sustituye el interiorismo de la cenital.
    prepared.request.referenceImages = [...(prepared.request.referenceImages ?? []), ...(correction ? [correction.image] : []), exterior];
    if (correction) prepared.request.prompt += `\n${correction.instruction}`;
    prepared.request.prompt += '\nLa última imagen fija únicamente fachada, cubierta y pérgolas exteriores. El mobiliario y los acabados interiores siguen la cenital aceptada, sin mezclarlos con otros diseños.';
    if (edit) prepared.request.prompt = visitRegionPrompt(edit, prepared.acceptedBrief, {
      openings: cameraOpeningLocations(view, spatial.context), depths: openingSightlineDepths(document, view, spatial.context) });
    const translation = await englishImagePrompt(vision, prepared.request.prompt);
    prepared.request.prompt = translation.prompt;
    prepared.request.compactPrompt = prepared.request.prompt;
    const adapter = await getImageAdapterForAction(attribution, 'render3d', { provider: route!.provider, model: route!.model, maxUsd: consent.maxImageUsd });
    imageSubmitted = true;
    const result = edit ? await adapter.inpaint({ baseImage: correction!.image, zone: edit.zone,
      eraseZone: edit.eraseZone, prompt: prepared.request.prompt }) : await adapter.generate(prepared.request);
    const bytes = await readRenderBytes(result), candidate = await sanitizeOwnRenderBuffer(bytes.raw);
    const review = await reviewRenderFidelity(vision, prepared.reference, candidate, view, undefined, projectVehicleCount(document), false,
      { identity: prepared.styleAnchor ?? identity, architecture: exterior, interior: Boolean(context) }, false, false, spatial,
      { reference: 'capture', people: false, acceptedBrief: prepared.acceptedBrief, openingDepths: openingSightlineDepths(document, view, spatial.context) })
      .catch(unfinishedRenderReview);
    const key = `renders/visits/${ctx.organizationId}/${id}/${image.sourceId}.png`;
    await getStorageAdapter().put({ key, body: Buffer.from(candidate.base64, 'base64'), contentType: candidate.mimeType });
    await persistDeliverables(scope.projectId, [{ id: image.sourceId!, type: 'render3d', version: 1, legalSeal: DELIVERABLE_LEGAL_SEAL,
      payload: { type: 'render3d', assetKey: key, assetUrl: await getStorageAdapter().getPresignedDownloadUrl(key), camera: image.frame.camera,
        ...(result.regionEdit ? { imageEdit: { ...result.regionEdit, sourceDeliverableId: correction!.sourceId } } : {}),
        generation: { ...result.generation, ...review, promptVersion: SELECTED_VIEW_IMAGE_PROMPT_VERSION, documentRevision: job.approvedRevision,
          view, options, batchId: id, referenceDesignId: job.anchorIds[0], sentPrompt: prepared.request.prompt,
          acceptedBrief: prepared.acceptedBrief,
          ...(translation.translated ? { promptLanguage: 'en' as const } : {}),
          propertyVisit: { id, imageId, openDoors: job.openDoors, anchorIds: job.anchorIds,
            ...(correction ? { correctionSourceId: correction.sourceId } : {}) } } } }],
    undefined, scope.zoneId ?? null, { allowEditorV2: true });
    image.state = 'review';
    await updatePropertyVisit(ctx, scope, id, version, job);
    return { sourceId: image.sourceId };
  } catch (error) {
    image.state = imageSubmitted ? 'unknown' : 'failed'; image.error = error instanceof Error ? error.message : 'No se pudo confirmar la imagen.';
    await updatePropertyVisit(ctx, scope, id, version, job);
    throw new Error(`${image.error} ${imageSubmitted ? 'Conservamos el intento; comprueba Diseños antes de repetir gasto.' : 'No se envió al generador de imágenes. Los análisis previos realizados sí pueden tener coste.'}`);
  }
}
