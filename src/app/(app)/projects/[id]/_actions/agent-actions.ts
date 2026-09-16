'use server';

/**
 * Server Actions finas que conectan la UI con el orquestador del agente. No
 * contienen lógica de negocio ni prompts: resuelven la organización de la sesión,
 * crean la sesión de agente y delegan en `advance`. La IA y las guardas viven en
 * el servidor (F5/F3).
 */
import { requireOrgContext } from '@/server/auth/require-org-context';
import { revalidatePath } from 'next/cache';
import type { OrgContext } from '@/server/auth/org-context';
import { withOrg } from '@/server/db/scoped-repo';
import { withLegacyAuthority } from '@/server/editor/authority';
import { getStorageAdapter } from '@/server/storage/s3-storage-adapter';
import { MAX_IMAGE_BYTES } from '@/server/ai/call-limits';
import { sanitizeImageBuffer } from '@/server/ai/image/input-sanitizer';
import { renderViewSchema, type RenderCapture } from '@/lib/editor-document/render-view';
import { selectedViewPrompt, SELECTED_VIEW_PROMPT_VERSION } from '@/server/agent/editor-v2/selected-view-prompt';
import { persistDeliverables } from '@/server/agent/persistence/deliverable-repo';
import { DELIVERABLE_LEGAL_SEAL } from '@/server/agent/legal/seal';
import { persistSourceImage } from '@/server/agent/persistence/source-image-repo';
import {
  getAgent,
  type AgentInput,
  type AgentOutcome,
  type ZoneDeliveryContext,
} from '@/server/agent';
import { getChatVisionAdapter, getImageAdapterForAction } from '@/server/ai';
import {
  assertPlanoRasterizable,
  generateCenital,
  generateCenitalFromImage,
} from '@/server/ai/design/cenital-pipeline';
import { importPlanToEditor } from '@/server/plan/import-plan-to-editor';
import { redrawPlan } from '@/server/ai/design/redraw-plan-pipeline';
import { recommendDecoration as runRecommend } from '@/server/agent/phases/decoracion';
import { detectLayout } from '@/server/agent/phases/deteccion-layout';
import { assertConsent } from '@/server/privacy/consent-service';
import { assertTosAccepted } from '@/server/legal/tos-acceptance-service';
import { deserializeCanvas } from '@/canvas/serialize';
import { serializeDocToPrompt } from '@/canvas/serialize-doc-to-prompt';
import { rasterizeCanvasDoc } from '@/server/agent/canvas/rasterize-canvas-doc';
import { rasterizeEditorDesignReferences } from '@/server/agent/editor-v2/rasterize-editor-references';
import { proposeNativeDesign } from '@/server/agent/editor-v2/native-design-proposal';
import { conceptRenderPrompt } from '@/server/agent/editor-v2/concept-render-prompt';
import { isValidEstilo, isValidEntregable } from '@/lib/design-options';
import { parseEditorDocument } from '@/lib/editor-document/validation';
import { buildEditorRenderContract } from '@/lib/editor-document/render-contract';
import { isDesignSpaceKind, type DesignSpaceKind } from '@/lib/design-space-kind';
import type { NativeDesignProposal } from '@/lib/editor-document/native-design-proposal';
import { renderDesignOptionsSchema, type RenderDesignOptions } from '@/lib/editor-document/render-design-options';
import { resolveRoutes } from '@/server/ai/model-routing';
import { allowedModel } from '@/server/admin/config/model-allowlist';
import { assertSafeImportUrl } from '@/server/admin/media/url-safety';
import { z } from 'zod';
import type {
  DeliverableType,
  Estilo,
  DecorRecommendation,
  DetectedObject,
  MessagePart,
  Plano2dPayload,
} from '@/lib/contracts';

const NATIVE_RENDER_DATA_URL = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/;
const STORED_RENDER_DATA_URL = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/;
const conceptRenderSettingsSchema = z.object({
  options: renderDesignOptionsSchema.optional(),
  batchId: z.string().uuid().optional(),
  referenceDesignId: z.string().min(1).max(200).optional(),
}).strict();

async function readRenderReference(payload: { assetKey?: unknown; assetUrl?: unknown }) {
  if (typeof payload.assetKey === 'string' && payload.assetKey.length > 0)
    return sanitizeImageBuffer(await getStorageAdapter().get(payload.assetKey));
  if (typeof payload.assetUrl !== 'string') throw new Error('El diseño de referencia no tiene una imagen recuperable.');
  const data = STORED_RENDER_DATA_URL.exec(payload.assetUrl);
  if (data?.[1] && data[2]) return sanitizeImageBuffer(Buffer.from(data[2], 'base64'));
  const url = assertSafeImportUrl(payload.assetUrl);
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error('No se pudo recuperar el diseño de referencia.');
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BYTES)
    throw new Error('El diseño de referencia excede el tamaño permitido.');
  if (!response.body) throw new Error('No se pudo leer el diseño de referencia.');
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.byteLength;
      if (total > MAX_IMAGE_BYTES) throw new Error('El diseño de referencia excede el tamaño permitido.');
      chunks.push(Buffer.from(part.value));
    }
  } finally {
    reader.releaseLock();
  }
  return sanitizeImageBuffer(Buffer.concat(chunks, total));
}

/**
 * Verifica que el proyecto pertenece a la organización de la sesión. El agente
 * (`loadState`/`persistDeliverables`) opera por `projectId` sin acotar org, así que
 * la pertenencia se valida AQUÍ, en la única puerta de entrada, antes de delegar.
 */
async function assertProjectInOrg(
  ctx: OrgContext,
  projectId: string,
  zoneId: string | null = null,
): Promise<void> {
  const project = await withOrg(ctx).projects.findById(projectId);
  if (!project) throw new Error('Proyecto no encontrado en tu organización');
  // These actions still consume legacy documents. Reject migrated scopes before IA/cost.
  await withLegacyAuthority(ctx, { projectId, zoneId }, async () => undefined);
}

/** El documento V2 ya tiene su propia autoridad; no debe pasar por la puerta legacy. */
async function assertV2ProjectInOrg(ctx: OrgContext, projectId: string): Promise<void> {
  const project = await withOrg(ctx).projects.findById(projectId);
  if (!project) throw new Error('Proyecto no encontrado en tu organización');
}

/**
 * Verifica que la zona (si se indica) pertenece al proyecto de la org. Devuelve el zoneId
 * validado o null. Anti-IDOR: un zoneId de otro proyecto/org no se acepta (cae a error).
 */
async function assertZoneInProject(
  ctx: OrgContext,
  projectId: string,
  zoneId: string | null,
): Promise<string | null> {
  if (!zoneId) return null;
  const zones = await withOrg(ctx).zones.list(projectId);
  if (!zones.some((z) => z.id === zoneId)) {
    throw new Error('Zona no encontrada en el proyecto');
  }
  return zoneId;
}

export async function advanceAgent(
  projectId: string,
  input: AgentInput,
  zoneId: string | null = null,
): Promise<AgentOutcome> {
  const ctx = await requireOrgContext();
  await assertProjectInOrg(ctx, projectId, zoneId);
  const zid = await assertZoneInProject(ctx, projectId, zoneId);

  // La imagen de origen se persiste en esta capa (la que posee el scope de org),
  // no en el orquestador (deliberadamente org-agnóstico). Solo en la ingesta y
  // solo si trae bytes embebidos; el gate de consentimiento del orquestador corta
  // el procesamiento aguas abajo si falta base legal. La imagen se asocia a la zona.
  if (input.action === 'ingest') {
    await assertConsent(ctx.userId, 'IMAGE_PROCESSING');
    await persistIngestImages(ctx, projectId, input.image, zid);
  }

  const agent = await getAgent(ctx.organizationId, ctx.userId, makeZoneContextResolver(ctx));
  return agent.advance(projectId, input, zid);
}

/**
 * Resuelve el contexto de zona que la entrega por chat necesita: el tipo de zona
 * (interior/exterior, para el prompt) y la foto PRIMARY de la zona cargada como
 * referencia img2img (bytes desde el storage) + su id (trazabilidad). Pasa por la
 * puerta anti-IDOR (`withOrg`) y por el storage server-only, manteniendo el agente
 * org-agnóstico. Si la foto no puede leerse del storage, degrada a `reference: null`
 * (el render parte solo del estilo) en vez de tumbar una entrega que ya se cobra.
 */
/** Resolver de contexto vacío: para flujos que aportan su propia referencia (lienzo/3D). */
async function noZoneContext(): Promise<ZoneDeliveryContext> {
  return { zoneKind: null, reference: null };
}

function makeZoneContextResolver(
  ctx: OrgContext,
): (projectId: string, zoneId: string | null) => Promise<ZoneDeliveryContext> {
  return async (projectId, zoneId) => {
    const repo = withOrg(ctx);
    const zoneKind = zoneId
      ? ((await repo.zones.list(projectId)).find((z) => z.id === zoneId)?.kind ?? null)
      : null;

    const primary = await repo.sourceImages.latestPrimary(projectId, zoneId);
    if (!primary) return { zoneKind, reference: null };

    try {
      const body = await getStorageAdapter().get(primary.key);
      return {
        zoneKind,
        reference: {
          sourceImageId: primary.id,
          image: { base64: body.toString('base64'), mimeType: primary.mime },
        },
      };
    } catch {
      // La foto existe en BD pero no se pudo leer del storage: no se rompe la
      // entrega; se genera sin referencia (comportamiento previo a img2img).
      return { zoneKind, reference: null };
    }
  };
}

/** Persiste las imágenes embebidas de la ingesta como SourceImage de la zona (scope org). */
async function persistIngestImages(
  ctx: OrgContext,
  projectId: string,
  parts: MessagePart[],
  zoneId: string | null,
): Promise<void> {
  const repo = withOrg(ctx);
  const storage = getStorageAdapter();
  for (const part of parts) {
    if (part.type !== 'image_url' || !part.base64) continue;
    const body = Buffer.from(part.base64, 'base64');
    await persistSourceImage(repo, storage, {
      organizationId: ctx.organizationId,
      projectId,
      zoneId,
      body,
    });
  }
}

/**
 * Genera un diseño a partir del lienzo (CRL-4). Recibe el documento ACTUAL del
 * cliente (no el persistido, que puede ir por detrás del autosave con debounce),
 * lo serializa a texto y lo rasteriza a PNG en el servidor, y delega en el agente.
 * El estilo y el entregable los elige el usuario en el mini-formulario del canvas.
 */
export async function generateDesignFromCanvas(
  projectId: string,
  rawDoc: unknown,
  estilo: Estilo,
  entregable: DeliverableType,
  objetivo = '',
  promptLibre = '',
  zoneId: string | null = null,
): Promise<AgentOutcome> {
  const ctx = await requireOrgContext();
  await assertProjectInOrg(ctx, projectId, zoneId);
  const zid = await assertZoneInProject(ctx, projectId, zoneId);
  // Validación de entrada en el boundary RSC: el cliente puede enviar cualquier
  // string pese al tipo. Estilo/entregable inválidos no llegan al prompt ni a la
  // selección de rama de generación.
  if (!isValidEstilo(estilo)) throw new Error('Estilo no válido');
  if (!isValidEntregable(entregable)) throw new Error('Tipo de entregable no válido');

  // Normaliza el doc del cliente con el mismo deserializador defensivo del canvas.
  const doc = deserializeCanvas(rawDoc);
  const description = serializeDocToPrompt(doc);
  if (!description) {
    throw new Error('El plano está vacío: añade elementos antes de generar un diseño.');
  }
  const { base64, aspectRatio } = await rasterizeCanvasDoc(doc);

  // El lienzo rasterizado no es una imagen de origen del usuario, y este flujo
  // aporta su propia referencia (el sketch): no resuelve contexto de zona.
  const agent = await getAgent(ctx.organizationId, ctx.userId, noZoneContext);
  return agent.advance(
    projectId,
    {
      action: 'generate-from-canvas',
      estilo,
      entregable,
      // Objetivo opcional del formulario (paridad con el chat); se acota en longitud.
      // Coerción a string defensiva: el cliente puede enviar cualquier valor pese al tipo.
      objetivo: String(objetivo ?? '').slice(0, 200),
      // Instrucción libre del usuario; se acota para no inflar el prompt del render.
      promptLibre: String(promptLibre ?? '').slice(0, 500),
      description,
      referenceImage: { base64, mimeType: 'image/png' },
      aspectRatio,
      // Cada invocación es una operación de pago distinta: id único para la clave
      // idempotente del cobro (evita regeneración gratis por clave constante).
      requestId: globalThis.crypto.randomUUID(),
    },
    zid,
  );
}

/**
 * Genera desde el documento nativo del editor nuevo. La UI vacía antes la cola de
 * guardado y bloquea conflictos; esta acción vuelve a validar todo el payload para
 * que la geometría enviada al proveedor sea segura y reproducible.
 */
export async function generateDesignFromEditor(
  projectId: string,
  rawDocument: unknown,
  estilo: Estilo,
  entregable: DeliverableType,
  spaceKind: DesignSpaceKind,
  objetivo = '',
  promptLibre = '',
  zoneId: string | null = null,
): Promise<AgentOutcome> {
  const ctx = await requireOrgContext();
  await assertV2ProjectInOrg(ctx, projectId);
  const zid = await assertZoneInProject(ctx, projectId, zoneId);
  if (!isValidEstilo(estilo)) throw new Error('Estilo no válido');
  if (!isValidEntregable(entregable)) throw new Error('Tipo de entregable no válido');
  if (!isDesignSpaceKind(spaceKind)) throw new Error('Selecciona el tipo de espacio en el canvas.');

  const document = parseEditorDocument(rawDocument);
  if (!document.designSpaceKind)
    throw new Error('Define el tipo de espacio en el canvas antes de generar un diseño.');
  if (document.designSpaceKind !== spaceKind)
    throw new Error('El tipo de espacio cambió. Guarda el canvas e inténtalo de nuevo.');
  if (
    !document.walls.length &&
    !document.furniture.length &&
    !document.stairs?.length &&
    !document.ramps?.length
  ) {
    throw new Error(
      'El plano está vacío: añade estructura o elementos antes de generar un diseño.',
    );
  }

  // El modelo recibe fichas explícitas por elemento, no un JSON geométrico que
  // pueda malinterpretar como una sugerencia decorativa.
  const renderContract = buildEditorRenderContract(document);
  const description = renderContract.prompt;
  const references = await rasterizeEditorDesignReferences(document);
  const agent = await getAgent(ctx.organizationId, ctx.userId, noZoneContext);
  return agent.advance(
    projectId,
    {
      action: 'generate-from-canvas',
      estilo,
      entregable,
      objetivo: String(objetivo ?? '').slice(0, 200),
      promptLibre: String(promptLibre ?? '').slice(0, 500),
      description,
      structuralAudit: renderContract.auditPrompt,
      referenceImage: references.primary,
      referenceImages: references.all,
      aspectRatio: references.aspectRatio,
      spaceKind: document.designSpaceKind,
      documentSource: 'editor-v2',
      requestId: globalThis.crypto.randomUUID(),
    },
    zid,
  );
}

/**
 * Diseña sobre la escena nativa. La IA devuelve únicamente una propuesta validada
 * de acabados y muebles del catálogo: jamás geometría ni un render reconstruido.
 */
export async function proposeNativeDesignFromEditor(
  projectId: string,
  rawDocument: unknown,
  estilo: Estilo,
  spaceKind: DesignSpaceKind,
  objetivo = '',
  promptLibre = '',
  zoneId: string | null = null,
  rawOptions?: RenderDesignOptions,
): Promise<NativeDesignProposal> {
  const ctx = await requireOrgContext();
  await assertV2ProjectInOrg(ctx, projectId);
  await assertZoneInProject(ctx, projectId, zoneId);
  if (!isValidEstilo(estilo)) throw new Error('Estilo no válido');
  if (!isDesignSpaceKind(spaceKind)) throw new Error('Selecciona el tipo de espacio en el canvas.');
  const document = parseEditorDocument(rawDocument);
  if (!document.designSpaceKind || document.designSpaceKind !== spaceKind)
    throw new Error('El tipo de espacio cambió. Guarda el canvas e inténtalo de nuevo.');
  if (!document.walls.length && !document.furniture.length && !document.stairs?.length && !document.ramps?.length)
    throw new Error('El plano está vacío: añade estructura o elementos antes de pedir una propuesta.');

  const options = renderDesignOptionsSchema.parse(rawOptions ?? {});
  const references = await rasterizeEditorDesignReferences(document);
  const referenceParts: MessagePart[] = references.all.slice(0, 4).map((image) => ({
    type: 'image_url', base64: image.base64, mimeType: image.mimeType,
  }));
  const chat = await getChatVisionAdapter({ organizationId: ctx.organizationId, userId: ctx.userId, projectId }, 'vision');
  return proposeNativeDesign(
    chat, document, estilo, String(objetivo).slice(0, 200), String(promptLibre).slice(0, 500), referenceParts,
    options,
  );
}

/**
 * Render conceptual desde la planta nativa con el baseline validado en KIE.
 * El documento editable nunca se modifica.
 */
export async function generateConceptRenderFromEditor(
  projectId: string,
  rawDocument: unknown,
  estilo: Estilo,
  objetivo = '',
  promptLibre = '',
  zoneId: string | null = null,
  capture?: RenderCapture,
  settings?: { options?: RenderDesignOptions; batchId?: string; referenceDesignId?: string },
): Promise<{ id: string; assetUrl: string; generation?: import('@/lib/contracts').ImageResult['generation'] }> {
  const ctx = await requireOrgContext();
  await assertV2ProjectInOrg(ctx, projectId);
  const zid = await assertZoneInProject(ctx, projectId, zoneId);
  await assertConsent(ctx.userId, 'IMAGE_PROCESSING');
  await assertTosAccepted(ctx.userId);
  if (!isValidEstilo(estilo)) throw new Error('Estilo no válido');

  const document = parseEditorDocument(rawDocument);
  if (!document.walls.length && !document.stairs?.length && !document.ramps?.length) {
    throw new Error('El plano está vacío: añade estructura antes de crear un render.');
  }
  const view = capture ? renderViewSchema.parse(capture.view) : undefined;
  const parsedSettings = conceptRenderSettingsSchema.parse(settings ?? {});
  const options = renderDesignOptionsSchema.parse(parsedSettings.options ?? {});
  if (options.views.length > 1 && !capture)
    throw new Error('Las vistas múltiples requieren una captura por vista.');
  if (view?.lighting && view.lighting !== options.lighting)
    throw new Error('La iluminación de las opciones no coincide con la captura de la vista.');
  let reference: Awaited<ReturnType<typeof sanitizeImageBuffer>> | undefined;
  if (capture) {
    if (typeof capture.dataUrl !== 'string' || capture.dataUrl.length > 14_000_000) throw new Error('La captura excede el tamaño permitido.');
    const match = NATIVE_RENDER_DATA_URL.exec(capture.dataUrl);
    if (!match?.[1]) throw new Error('La captura de referencia no tiene formato PNG válido.');
    reference = await sanitizeImageBuffer(Buffer.from(match[1], 'base64'));
  }
  let referenceDesign: { base64: string; mimeType: string } | undefined;
  if (parsedSettings.referenceDesignId) {
    const deliverable = (await withOrg(ctx).deliverables.list(projectId)).find(
      (item) => item.id === parsedSettings.referenceDesignId && item.zoneId === zid && item.type === 'RENDER_3D',
    );
    const payload = deliverable?.payload as { type?: string; assetKey?: unknown; assetUrl?: unknown } | undefined;
    if (!deliverable || payload?.type !== 'render3d') {
      throw new Error('El diseño de referencia no pertenece al proyecto, organización o zona.');
    }
    const sourceImage = await readRenderReference(payload);
    referenceDesign = { base64: sourceImage.base64, mimeType: sourceImage.mimeType };
  }
  const id = `del-${projectId}-render3d-${globalThis.crypto.randomUUID()}`;
  const prompt = view
    ? selectedViewPrompt(document, view, estilo, String(objetivo).slice(0, 200), String(promptLibre).slice(0, 500), options)
    : conceptRenderPrompt(document, estilo, String(objetivo).slice(0, 200), String(promptLibre).slice(0, 500));
  const references = [
    ...(reference ? [{ base64: reference.base64, mimeType: reference.mimeType }] : []),
    ...(referenceDesign ? [{ base64: referenceDesign.base64, mimeType: referenceDesign.mimeType }] : []),
  ];
  const referenceStyleNote = referenceDesign
    ? '\n\nLa segunda imagen adjunta es solo una referencia de estilo y acabado. No la uses para inferir, sustituir ni modificar geometría, cámara, proporciones o distribución del proyecto.'
    : '';
  const image = await getImageAdapterForAction({ organizationId: ctx.organizationId, userId: ctx.userId, projectId, refId: id, batchId: parsedSettings.batchId }, 'render3d');
  const result = await image.generate({
    prompt: prompt + referenceStyleNote,
    ...(view ? { compactPrompt: selectedViewPrompt(document, view, estilo, String(objetivo).slice(0, 200), String(promptLibre).slice(0, 500), options, true) + referenceStyleNote } : {}),
    // Sin ratio forzado: KIE usa auto y toma la referencia, no estira a 16:9.
    ...(references.length ? { referenceImages: references } : {}),
  });
  await persistDeliverables(projectId, [{
    id,
    type: 'render3d',
    payload: { type: 'render3d', assetUrl: result.assetUrl, ...(result.assetKey ? { assetKey: result.assetKey } : {}),
      generation: { ...result.generation, promptVersion: view ? SELECTED_VIEW_PROMPT_VERSION : 'kie-baseline-v1', documentRevision: document.revision, ...(view ? { view } : {}), options, ...(parsedSettings.batchId ? { batchId: parsedSettings.batchId } : {}), ...(parsedSettings.referenceDesignId ? { referenceDesignId: parsedSettings.referenceDesignId } : {}) } },
    legalSeal: DELIVERABLE_LEGAL_SEAL,
    version: 1,
  }], undefined, zid, { allowEditorV2: true });
  revalidatePath(`/projects/${projectId}/deliverables`);
  revalidatePath(`/projects/${projectId}/historial`);
  return { id, assetUrl: result.assetUrl, generation: result.generation };
}

/** Estimación local: resuelve la ruta y consulta solo precios explícitos de la allowlist. */
export async function estimateConceptRenderFromEditor(
  projectId: string,
  viewCount: number,
): Promise<{ estimatedUsd: number; model: string }> {
  const ctx = await requireOrgContext();
  await assertV2ProjectInOrg(ctx, projectId);
  if (!Number.isFinite(viewCount) || !Number.isInteger(viewCount) || viewCount < 1 || viewCount > 8)
    throw new Error('El número de vistas debe ser un entero entre 1 y 8.');
  const route = (await resolveRoutes('render3d'))[0];
  if (!route) throw new Error('No hay modelo de render configurado.');
  const price = allowedModel('render3d', route.model, route.provider)?.priceUsdPerUnit;
  if (price === undefined || !Number.isFinite(price) || price < 0)
    throw new Error(`No hay precio estimado conocido para ${route.provider}:${route.model}.`);
  return { estimatedUsd: Number((price * viewCount).toFixed(4)), model: `${route.provider}:${route.model}` };
}

/**
 * Genera una VISTA estilizada a partir de una captura de la escena 3D (Fase 3). La captura
 * (data URL base64 del canvas WebGL, tal cual la entrega el visor) se pasa como imagen base
 * al proveedor (img2img) junto al estilo elegido, para que el render herede el encuadre y la
 * geometría de la sala. Reusa el camino `generate-from-canvas` del orquestador. La vista se
 * asocia a la zona activa.
 */
export async function generateViewFrom3D(
  projectId: string,
  captureDataUrl: string,
  estilo: Estilo,
  aspectRatio: string,
  zoneId: string | null = null,
): Promise<AgentOutcome> {
  const ctx = await requireOrgContext();
  await assertProjectInOrg(ctx, projectId, zoneId);
  const zid = await assertZoneInProject(ctx, projectId, zoneId);
  if (!isValidEstilo(estilo)) throw new Error('Estilo no válido');

  // La captura llega como data URL ("data:image/png;base64,XXXX"); se extrae el base64.
  const base64 = captureDataUrl.includes(',') ? captureDataUrl.split(',')[1]! : captureDataUrl;
  if (!base64) throw new Error('Captura de la vista 3D vacía');

  // La captura 3D es la propia referencia (sketch): no resuelve contexto de zona.
  const agent = await getAgent(ctx.organizationId, ctx.userId, noZoneContext);
  return agent.advance(
    projectId,
    {
      action: 'generate-from-canvas',
      estilo,
      entregable: 'render3d',
      objetivo: '',
      promptLibre: '',
      // La imagen base aporta la geometría; la descripción solo orienta al modelo.
      description: 'Vista 3D de la sala capturada desde el editor.',
      referenceImage: { base64, mimeType: 'image/png' },
      aspectRatio,
      requestId: globalThis.crypto.randomUUID(),
    },
    zid,
  );
}

/**
 * Conserva una captura de la escena Three.js como entregable del proyecto. La
 * geometría no se reconstruye con IA: este PNG es la representación exacta del
 * canvas nativo y queda disponible en el historial con una URL re-firmable.
 */
export async function saveNativeRender(
  projectId: string,
  captureDataUrl: string,
  zoneId: string | null = null,
): Promise<{ id: string; assetUrl: string }> {
  const ctx = await requireOrgContext();
  await assertV2ProjectInOrg(ctx, projectId);
  const zid = await assertZoneInProject(ctx, projectId, zoneId);
  const match = NATIVE_RENDER_DATA_URL.exec(String(captureDataUrl ?? ''));
  if (!match?.[1]) throw new Error('La captura nativa no tiene un formato PNG válido.');

  const image = await sanitizeImageBuffer(Buffer.from(match[1], 'base64'));
  const id = `del-${projectId}-render3d-${globalThis.crypto.randomUUID()}`;
  const assetKey = `renders/${ctx.organizationId}/${projectId}/native/${globalThis.crypto.randomUUID()}.png`;
  let assetUrl: string;
  try {
    const storage = getStorageAdapter();
    await storage.put({
      key: assetKey,
      body: Buffer.from(image.base64, 'base64'),
      contentType: image.mimeType,
    });
    assetUrl = await storage.getPresignedDownloadUrl(assetKey);
  } catch {
    throw new Error('El almacenamiento de renders no está disponible. Revisa su configuración.');
  }
  await persistDeliverables(
    projectId,
    [{
      id,
      type: 'render3d',
      payload: { type: 'render3d', assetKey, assetUrl },
      legalSeal: DELIVERABLE_LEGAL_SEAL,
      version: 1,
    }],
    undefined,
    zid,
    { allowEditorV2: true },
  );
  revalidatePath(`/projects/${projectId}/deliverables`);
  revalidatePath(`/projects/${projectId}/historial`);
  return { id, assetUrl };
}

/**
 * Recomienda decoración para el plano (F4): la IA propone elementos del catálogo
 * según estilo + objetivo + lo ya colocado. El usuario las acepta/rechaza en la
 * UI; al aceptar se añaden como objetos editables del plano. Devuelve solo
 * recomendaciones válidas (kind del catálogo, posición finita); puede ser vacía.
 */
export async function recommendDecoration(
  projectId: string,
  rawDoc: unknown,
  estilo: Estilo,
  objetivo = '',
): Promise<DecorRecommendation[]> {
  const ctx = await requireOrgContext();
  await assertProjectInOrg(ctx, projectId);
  if (!isValidEstilo(estilo)) throw new Error('Estilo no válido');

  const doc = deserializeCanvas(rawDoc);
  const description = serializeDocToPrompt(doc);
  if (!description) {
    throw new Error('El plano está vacío: añade elementos antes de pedir sugerencias.');
  }

  const chat = await getChatVisionAdapter({ organizationId: ctx.organizationId }, 'chat');
  return runRecommend(chat, estilo, String(objetivo ?? '').slice(0, 200), description);
}

/**
 * Detecta los elementos de una foto/boceto y devuelve sus posiciones (bbox) para
 * poblar el plano (F5, BETA). Procesa una imagen con IA: mismo deber RGPD que la
 * ingesta (gate de consentimiento + ToS) y se acota por organización. La calidad
 * de la detección sobre foto en perspectiva es imprecisa: se ofrece como BETA.
 */
export async function detectPlanFromPhoto(
  projectId: string,
  imageParts: MessagePart[],
): Promise<DetectedObject[]> {
  const ctx = await requireOrgContext();
  await assertProjectInOrg(ctx, projectId);
  await assertConsent(ctx.userId, 'IMAGE_PROCESSING');
  await assertTosAccepted(ctx.userId);

  // Usa el adaptador de VISIÓN (la detección lee una imagen), no el de chat texto.
  const chat = await getChatVisionAdapter({ organizationId: ctx.organizationId }, 'vision');
  return detectLayout(chat, imageParts);
}





/**
 * Redibuja el plano subido como plano de arquitectura profesional, imagen a
 * imagen (una sola llamada al modelo de imagen; el modelo se resuelve por la
 * acción `render3d` del back-office). Es la vía VISUAL principal: preserva la
 * disposición mucho mejor que reconstruir la geometría en coordenadas.
 */
export async function redrawPlanFromImage(
  projectId: string,
  imageParts: MessagePart[],
): Promise<{ imageUrl: string }> {
  const ctx = await requireOrgContext();
  await assertProjectInOrg(ctx, projectId);
  await assertConsent(ctx.userId, 'IMAGE_PROCESSING');
  await assertTosAccepted(ctx.userId);

  const source = imageParts.find(
    (p): p is Extract<MessagePart, { type: 'image_url' }> => p.type === 'image_url',
  );
  if (!source?.base64) throw new Error('Falta la imagen del plano.');

  const image = await getImageAdapterForAction({ organizationId: ctx.organizationId }, 'render3d');
  const result = await redrawPlan(
    { image },
    { base64: source.base64, ...(source.mimeType ? { mimeType: source.mimeType } : {}) },
  );
  return { imageUrl: result.assetUrl };
}

/**
 * Materializa el plano extraído como documento del EDITOR: muros y aberturas
 * editables (mismo camino que el dibujo a mano) más la escala. REEMPLAZA el
 * plano por defecto del proyecto — la UI pide confirmación antes de llamar.
 */
export async function sendPlanoToEditor(projectId: string, plano: Plano2dPayload): Promise<void> {
  const ctx = await requireOrgContext();
  // Escribe con autoridad de EDITOR (activa v2 si el proyecto aún vive en el
  // canvas legacy; revisión nueva si ya está activado). No pasa por la puerta
  // legacy: un proyecto ya migrado también puede recibir un plano extraído.
  await assertV2ProjectInOrg(ctx, projectId);
  // Mismas cotas de cordura que el resto de consumidores del payload cliente.
  assertPlanoRasterizable(plano);
  await importPlanToEditor(ctx, projectId, {
    plano,
    escalaEstimada: false,
    writtenDimensions: [],
    corrections: [],
    exteriors: [],
    furniture: [],
    warnings: [],
  });
}

/** Resuelve los bytes de la imagen redibujada: data URL o asset de nuestro storage. */
async function imageBytesFromTrustedUrl(
  url: string,
): Promise<{ base64: string; mimeType: string }> {
  const dataUrl = /^data:([^;]+);base64,(.+)$/.exec(url);
  if (dataUrl?.[1] && dataUrl[2]) return { mimeType: dataUrl[1], base64: dataUrl[2] };

  const storageEndpoint = process.env.STORAGE_ENDPOINT;
  if (storageEndpoint && url.startsWith(storageEndpoint)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('No se pudo recuperar el plano redibujado del storage.');
    const bytes = Buffer.from(await res.arrayBuffer());
    return {
      base64: bytes.toString('base64'),
      mimeType: res.headers.get('content-type') ?? 'image/png',
    };
  }
  throw new Error('URL de imagen no permitida.');
}

/**
 * Render cenital directamente desde el plano REDIBUJADO (imagen→imagen): la
 * misma vía que hace fiel el redibujado, sin depender de la extracción
 * vectorial. Acepta solo data URLs o URLs de nuestro storage.
 */
export async function generateCenitalFromRedrawn(
  projectId: string,
  imageUrl: string,
  estilo: Estilo,
  /** Detalles del propietario sobre su casa (mobiliario real por estancia). */
  instrucciones = '',
): Promise<{ imageUrl: string }> {
  const ctx = await requireOrgContext();
  await assertProjectInOrg(ctx, projectId);
  await assertTosAccepted(ctx.userId);
  if (!isValidEstilo(estilo)) throw new Error('Estilo no válido');

  const source = await imageBytesFromTrustedUrl(imageUrl);
  const image = await getImageAdapterForAction({ organizationId: ctx.organizationId }, 'render3d');
  const result = await generateCenitalFromImage(
    { image },
    source,
    estilo,
    String(instrucciones ?? '').slice(0, 800),
  );
  return { imageUrl: result.assetUrl };
}

/**
 * Render cenital fotorrealista desde el plano métrico (F3): el plano viaja al
 * modelo de imagen COMO RASTER de referencia (image-to-image), no como texto.
 * El payload viene del cliente: el pipeline lo acota antes de rasterizar. El
 * modelo se resuelve por la acción `render3d` (config del back-office).
 */
export async function generateCenitalFromPlano(
  projectId: string,
  plano: Plano2dPayload,
  estilo: Estilo,
): Promise<{ imageUrl: string }> {
  const ctx = await requireOrgContext();
  await assertProjectInOrg(ctx, projectId);
  await assertTosAccepted(ctx.userId);
  if (!isValidEstilo(estilo)) throw new Error('Estilo no válido');

  const image = await getImageAdapterForAction({ organizationId: ctx.organizationId }, 'render3d');
  const result = await generateCenital({ image }, plano, estilo);
  return { imageUrl: result.assetUrl };
}
