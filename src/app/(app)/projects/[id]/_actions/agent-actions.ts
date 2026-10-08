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
import { sanitizeImageBuffer, sanitizeOwnRenderBuffer } from '@/server/ai/image/input-sanitizer';
import { cameraPoseFromView } from '@/lib/contracts/walkthrough-keyframe';
import { renderViewSchema, type RenderCapture, type RenderView } from '@/lib/editor-document/render-view';
import { projectVehicleCount, SELECTED_VIEW_IMAGE_PROMPT_VERSION } from '@/server/agent/editor-v2/selected-view-image-prompt';
import { SIMPLE_PLAN_PROMPT_VERSION, SIMPLE_SECTION_PROMPT_VERSION } from '@/server/agent/editor-v2/simple-plan-prompt';
import { renderDrawingReferences } from '@/server/agent/editor-v2/render-drawing-references';
import { sectionFurnitureBrief } from '@/server/agent/editor-v2/section-furniture-brief';
import { interiorFurnitureBrief } from '@/server/agent/editor-v2/interior-furniture-brief';
import { prepareRenderImageRequest } from '@/server/agent/editor-v2/prepare-render-image-request';
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
import { rasterizeEditorDocument } from '@/server/agent/editor-v2/rasterize-editor-document';
import { proposeNativeDesign } from '@/server/agent/editor-v2/native-design-proposal';
import { loadSketchGuide } from '@/server/agent/editor-v2/sketch-furniture-guide';
import { isValidEstilo, isValidEntregable } from '@/lib/design-options';
import { parseEditorDocument } from '@/lib/editor-document/validation';
import { buildEditorRenderContract } from '@/lib/editor-document/render-contract';
import { isDesignSpaceKind, type DesignSpaceKind } from '@/lib/design-space-kind';
import type { NativeDesignProposal } from '@/lib/editor-document/native-design-proposal';
import { isInteriorRenderMode, MAX_RENDER_PASSES, renderDesignOptionsSchema, zoneCompositeActive, type RenderDesignOptions } from '@/lib/editor-document/render-design-options';
import { zoneMaskCoverage, ZONE_EMPTY_COVERAGE } from '@/server/agent/editor-v2/zone-mask-coverage';
import { isolateZoneResult } from '@/server/agent/editor-v2/zone-isolated-image';
import { reviewRenderFidelity, unfinishedRenderReview } from '@/server/agent/editor-v2/review-render-fidelity';
import { renderSpatialReference } from '@/server/agent/editor-v2/render-spatial-reference';
import { assertRenderViewIntegrity } from '@/lib/editor-document/render-view-integrity';
import { requestedRenderRedesign } from '@/lib/editor-document/render-redesign';
import { resolveRoutes } from '@/server/ai/model-routing';
import { allowedModel } from '@/server/admin/config/model-allowlist';
import { runAction, fail } from '@/server/errors/run-action';
import { assertEditorQuality } from '@/server/quality/editor-gate';
import { assertStudioPlanQuality } from '@/server/quality/studio-plan-gate';
import { loadStudio, saveStudio } from '@/server/plan/studio-repo';
import { assertFreePromptQuality } from '@/server/quality/instruction-gate';
import { buildEditorInstructionContext } from '@/server/quality/evidence/editor-instruction-context';
import { withEditorDocuments } from '@/server/editor/document-repo';
import { readRenderBytes } from '@/server/agent/editor-v2/render-asset-reader';
import { findBatchStyleAnchor } from '@/server/agent/editor-v2/batch-style-anchor';
import { assertRenderBatchCompatible } from '@/server/agent/editor-v2/render-batch-continuation';
import { verifiedEditorDocument } from '@/server/agent/editor-v2/verified-editor-document';
import { renderRoomContext } from '@/lib/editor-document/render-room-context';
import { droneReferences, lateralDesignReference, interiorDesignReference } from '@/server/agent/editor-v2/drone-references';
import { conceptRenderSettingsSchema, NATIVE_RENDER_DATA_URL } from '@/server/agent/editor-v2/concept-render-settings';
import { generateOrReviewRender, EXISTING_RENDER_REVIEW_VERSION } from '@/server/agent/editor-v2/existing-render-review';
import { englishImagePrompt } from '@/server/agent/editor-v2/english-image-prompt';
import type {
  DeliverableType,
  Estilo,
  DecorRecommendation,
  DetectedObject,
  MessagePart,
  Plano2dPayload,
} from '@/lib/contracts';

/**
 * Verifica que el proyecto pertenece a la organización de la sesión. El agente
 * (`loadState`/`persistDeliverables`) opera por `projectId` sin acotar org, así que
 * la pertenencia se valida AQUÍ, en la única puerta de entrada, antes de delegar.
 * No distingue entre planos legacy y del editor v2: el chat, la vista 3D y la
 * importación de planos no leen ni escriben el lienzo antiguo.
 */
async function assertProjectInOrg(ctx: OrgContext, projectId: string): Promise<void> {
  const project = await withOrg(ctx).projects.findById(projectId);
  if (!project) fail('Proyecto no encontrado en tu organización');
}

/**
 * Solo para las acciones que reciben un documento del lienzo antiguo: un plano ya
 * migrado al editor v2 no admite ese flujo, y se rechaza antes de IA/coste.
 */
async function assertLegacyCanvasProjectInOrg(
  ctx: OrgContext,
  projectId: string,
  zoneId: string | null = null,
): Promise<void> {
  await assertProjectInOrg(ctx, projectId);
  await withLegacyAuthority(ctx, { projectId, zoneId }, async () => undefined);
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
    fail('Zona no encontrada en el proyecto');
  }
  return zoneId;
}

export async function advanceAgent(
  projectId: string,
  input: AgentInput,
  zoneId: string | null = null,
) {
  return runAction(() => advanceAgentImpl(projectId, input, zoneId));
}

async function advanceAgentImpl(
  projectId: string,
  input: AgentInput,
  zoneId: string | null = null,
): Promise<AgentOutcome> {
  const ctx = await requireOrgContext();
  await assertProjectInOrg(ctx, projectId);
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
 *
 * Alcance de la capa de calidad: este flujo queda EXCLUIDO de la puerta previa
 * a propósito. El lienzo legacy está en retirada y no produce un documento
 * estructurado que Jev pueda juzgar (no hay muros, huecos ni escala que medir),
 * así que una puerta aquí sería un veredicto inventado. Todo lo que sustituye a
 * este flujo —editor v2, estudio del plano— sí pasa por la puerta.
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
  await assertLegacyCanvasProjectInOrg(ctx, projectId, zoneId);
  const zid = await assertZoneInProject(ctx, projectId, zoneId);
  // Validación de entrada en el boundary RSC: el cliente puede enviar cualquier
  // string pese al tipo. Estilo/entregable inválidos no llegan al prompt ni a la
  // selección de rama de generación.
  if (!isValidEstilo(estilo)) fail('Estilo no válido');
  if (!isValidEntregable(entregable)) fail('Tipo de entregable no válido');

  // Normaliza el doc del cliente con el mismo deserializador defensivo del canvas.
  const doc = deserializeCanvas(rawDoc);
  const description = serializeDocToPrompt(doc);
  if (!description) {
    fail('El plano está vacío: añade elementos antes de generar un diseño.');
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
  qualityAck = false,
): Promise<AgentOutcome> {
  const ctx = await requireOrgContext();
  await assertProjectInOrg(ctx, projectId);
  const zid = await assertZoneInProject(ctx, projectId, zoneId);
  if (!isValidEstilo(estilo)) fail('Estilo no válido');
  if (!isValidEntregable(entregable)) fail('Tipo de entregable no válido');
  if (!isDesignSpaceKind(spaceKind)) fail('Selecciona el tipo de espacio en el canvas.');

  const document = parseEditorDocument(rawDocument);
  if (!document.designSpaceKind)
    fail('Define el tipo de espacio en el canvas antes de generar un diseño.');
  if (document.designSpaceKind !== spaceKind)
    fail('El tipo de espacio cambió. Guarda el canvas e inténtalo de nuevo.');
  if (
    !document.walls.length &&
    !document.furniture.length &&
    !document.stairs?.length &&
    !document.ramps?.length
  ) {
    fail(
      'El plano está vacío: añade estructura o elementos antes de generar un diseño.',
    );
  }

  // Puerta de calidad: un plano roto no llega al modelo de imagen.
  await assertEditorQuality(ctx, { projectId, zoneId: zid }, document, qualityAck, 'diseno_editor');
  // La instrucción libre se interpreta como guía para generar, con el contexto del editor.
  // Un diseño no cambia la geometría: se juzga con el ámbito de un render.
  await assertFreePromptQuality(
    ctx,
    { projectId, refId: zid, generationContext: buildEditorInstructionContext(document, estilo, String(objetivo ?? '')) },
    String(promptLibre ?? ''),
    'render3d',
    'diseno_editor',
  );

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
  qualityAck = false,
) {
  return runAction(() =>
    proposeNativeDesignFromEditorImpl(
      projectId,
      rawDocument,
      estilo,
      spaceKind,
      objetivo,
      promptLibre,
      zoneId,
      rawOptions,
      qualityAck,
    ),
  );
}

async function proposeNativeDesignFromEditorImpl(
  projectId: string,
  rawDocument: unknown,
  estilo: Estilo,
  spaceKind: DesignSpaceKind,
  objetivo = '',
  promptLibre = '',
  zoneId: string | null = null,
  rawOptions?: RenderDesignOptions,
  qualityAck = false,
): Promise<NativeDesignProposal> {
  const ctx = await requireOrgContext();
  await assertProjectInOrg(ctx, projectId);
  const proposalZoneId = await assertZoneInProject(ctx, projectId, zoneId);
  if (!isValidEstilo(estilo)) fail('Estilo no válido');
  if (!isDesignSpaceKind(spaceKind)) fail('Selecciona el tipo de espacio en el canvas.');
  const document = await verifiedEditorDocument(ctx, { projectId, zoneId: proposalZoneId }, rawDocument);
  if (!document.designSpaceKind || document.designSpaceKind !== spaceKind)
    fail('El tipo de espacio cambió. Guarda el canvas e inténtalo de nuevo.');
  if (!document.walls.length && !document.furniture.length && !document.stairs?.length && !document.ramps?.length)
    fail('El plano está vacío: añade estructura o elementos antes de pedir una propuesta.');
  const options = renderDesignOptionsSchema.parse(rawOptions ?? {});
  const designZone = options.designScope === 'zone'
    ? document.designZones?.find((zone) => zone.id === options.designZoneId) : undefined;
  if (options.designScope === 'zone' && !designZone) fail('La zona de diseño ya no existe. Vuelve a elegirla.');

  // Puerta de calidad antes de resolver el modelo de visión: consume créditos.
  await assertEditorQuality(
    ctx,
    { projectId, zoneId: proposalZoneId },
    document,
    qualityAck,
    'propuesta_editable',
  );
  // La propuesta editable SÍ cambia muebles y acabados del plano: juzgarla con
  // el ámbito de un render produciría bloqueos falsos por «fuera de ámbito».
  await assertFreePromptQuality(
    ctx,
    { projectId, refId: proposalZoneId, generationContext: buildEditorInstructionContext(document, estilo, String(objetivo ?? ''), options) },
    String(promptLibre ?? ''),
    'propuesta',
    'propuesta_editable',
  );

  // La propuesta coloca muebles en planta: basta la cenital del plano con el giro de las puertas, sin alzados ni capturas.
  const plan = await rasterizeEditorDocument(document, designZone?.polygon, { doorLeaves: true });
  const referenceParts: MessagePart[] = [{ type: 'image_url', base64: plan.base64, mimeType: 'image/png' }];
  // Modelos de «Análisis visual» en su orden: si uno agota la salida sin devolver el JSON, responde el respaldo.
  const chat = await getChatVisionAdapter({ organizationId: ctx.organizationId, userId: ctx.userId, projectId }, 'vision');
  // Amueblar reproduce la distribución que el cliente dibujó en el boceto con el que importó el plano.
  const sketch = options.freedom === 'free' && options.designScope !== 'zone' ? await loadSketchGuide(ctx, projectId, proposalZoneId, chat, document) : null;
  return proposeNativeDesign(
    chat, document, estilo, String(objetivo).slice(0, 200), String(promptLibre).slice(0, 500), referenceParts,
    options, sketch,
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
  settings?: {
    options?: RenderDesignOptions;
    batchId?: string;
    qualityAck?: boolean;
    orthophotoDataUrl?: string;
    existingImageDataUrl?: string;
    designReferenceId?: string;
  },
) {
  return runAction(() =>
    generateConceptRenderFromEditorImpl(
      projectId,
      rawDocument,
      estilo,
      objetivo,
      promptLibre,
      zoneId,
      capture,
      settings,
    ),
  );
}

async function generateConceptRenderFromEditorImpl(
  projectId: string,
  rawDocument: unknown,
  estilo: Estilo,
  objetivo = '',
  promptLibre = '',
  zoneId: string | null = null,
  capture?: RenderCapture,
  settings?: {
    options?: RenderDesignOptions;
    batchId?: string;
    qualityAck?: boolean;
    styleAnchor?: boolean;
    orthophotoDataUrl?: string;
    existingImageDataUrl?: string;
    designReferenceId?: string;
  },
): Promise<import('@/lib/editor-document/render-design-options').RenderGeneratedResult & { id: string }> {
  const ctx = await requireOrgContext();
  await assertProjectInOrg(ctx, projectId);
  const zid = await assertZoneInProject(ctx, projectId, zoneId);
  await assertConsent(ctx.userId, 'IMAGE_PROCESSING');
  await assertTosAccepted(ctx.userId);
  if (!isValidEstilo(estilo)) fail('Estilo no válido');

  const document = await verifiedEditorDocument(ctx, { projectId, zoneId: zid }, rawDocument);
  if (!document.walls.length && !document.stairs?.length && !document.ramps?.length) {
    fail('El plano está vacío: añade estructura antes de crear un render.');
  }
  const view = capture ? renderViewSchema.parse(capture.view) : undefined;
  if (view) assertRenderViewIntegrity(document, view);
  const camera = view ? cameraPoseFromView(view) : undefined;
  const parsedSettings = conceptRenderSettingsSchema.parse(settings ?? {});
  // Puerta de calidad antes de tocar el adaptador de imagen: un plano bloqueado
  // no llega a generar ni a cobrarse.
  await assertEditorQuality(
    ctx,
    { projectId, zoneId: zid },
    document,
    parsedSettings.qualityAck === true,
    'render_concepto',
  );
  const options = renderDesignOptionsSchema.parse(parsedSettings.options ?? {});
  if (!capture || !view)
    fail('Para generar un diseño fiel prepara primero la captura de cada vista del 3D.');
  // La identidad se obtiene del documento verificado, nunca de etiquetas del cliente.
  delete view.roomId;
  delete view.roomName;
  delete view.roomAreaM2;
  delete view.zones;
  if (isInteriorRenderMode(options)) {
    const context = renderRoomContext(document, view);
    if (!context || !options.interiorRoomIds.includes(context.roomId))
      fail('La cámara no corresponde a una estancia elegida. Vuelve a preparar las vistas.');
    Object.assign(view, context);
  }
  if (view.lighting && view.lighting !== options.lighting)
    fail('La iluminación de las opciones no coincide con la captura de la vista.');
  await assertFreePromptQuality(
    ctx,
    { projectId, refId: zid, generationContext: buildEditorInstructionContext(document, estilo, String(objetivo ?? ''), options, view) },
    String(promptLibre ?? ''),
    'render3d',
    'render_concepto',
  );
  if (typeof capture.dataUrl !== 'string' || capture.dataUrl.length > 14_000_000) fail('La captura excede el tamaño permitido.');
  const match = NATIVE_RENDER_DATA_URL.exec(capture.dataUrl);
  if (!match?.[1]) fail('La captura de referencia no tiene formato PNG válido.');
  let reference = await sanitizeImageBuffer(Buffer.from(match[1], 'base64'));
  let zoneMask: Awaited<ReturnType<typeof sanitizeImageBuffer>> | undefined;
  if (zoneCompositeActive(options)) {
    const maskMatch = typeof capture.maskDataUrl === 'string' && capture.maskDataUrl.length <= 14_000_000
      ? NATIVE_RENDER_DATA_URL.exec(capture.maskDataUrl) : null;
    if (!maskMatch?.[1]) fail('Falta la máscara de las zonas permitidas. Vuelve a preparar las vistas.');
    zoneMask = await sanitizeImageBuffer(Buffer.from(maskMatch[1], 'base64'));
    if (await zoneMaskCoverage(Buffer.from(zoneMask.base64, 'base64')) < ZONE_EMPTY_COVERAGE)
      fail('La zona permitida no se ve en esta cámara. Cambia de ángulo o marca otra zona antes de generar.');
  }
  const id = `del-${projectId}-render3d-${globalThis.crypto.randomUUID()}`;
  // Las vistas lejanas y los laterales parten de una vista del mismo diseño. La ancla del lote solo se usa si el usuario
  // la pide: da estilo, pero puede arrastrar geometría de otra cámara a la nueva vista.
  const drone = await droneReferences(ctx, { projectId, zoneId: zid }, document, view, options, parsedSettings.orthophotoDataUrl, parsedSettings.designReferenceId);
  const lateral = drone ? null : await lateralDesignReference(ctx, { projectId, zoneId: zid }, document, view, options, parsedSettings.designReferenceId);
  const interior = await interiorDesignReference(ctx, { projectId, zoneId: zid }, document, view, options, parsedSettings.designReferenceId);
  const designReference = drone ?? lateral ?? interior;
  const redesignRequested = requestedRenderRedesign(options, objetivo, promptLibre);
  const styleAnchor = designReference?.identity ?? (parsedSettings.styleAnchor === true || redesignRequested
    ? await findBatchStyleAnchor(projectId, parsedSettings.batchId) : null);
  const generatedOptions = { ...options, redesignInterior: options.redesignInterior || (redesignRequested && !options.redesignFixed) };
  await assertRenderBatchCompatible(ctx, { projectId, zoneId: zid }, document, parsedSettings.batchId, generatedOptions);
  const spatial = await renderSpatialReference(document, view, options);
  const { plan, section } = await renderDrawingReferences(document, view, options, Boolean(lateral), Boolean(parsedSettings.existingImageDataUrl));
  // La revisión usa los modelos de «Análisis visual» en su orden, como el resto de funciones.
  const vision = await getChatVisionAdapter(
    { organizationId: ctx.organizationId, userId: ctx.userId, projectId, refId: id, batchId: parsedSettings.batchId }, 'vision',
  );
  const prepared = await prepareRenderImageRequest({ document, view, style: estilo, options,
    objective: String(objetivo), instruction: String(promptLibre), reference, zoneMask,
    styleAnchor, acceptedDesign: Boolean(designReference), environment: drone?.environment, spatial, plan,
    describeInterior: (top) => interiorFurnitureBrief(vision, top, view, spatial.context),
    section: section && { ...section, describe: (top, names, hints) => sectionFurnitureBrief(vision, top, names, hints) } });
  const { request } = prepared;
  // El prompt viaja en inglés, reglas y texto del usuario incluidos; se guarda el enviado para revisarlo.
  const english = parsedSettings.existingImageDataUrl ? null : await englishImagePrompt(vision, request.prompt);
  if (english?.translated) { request.prompt = english.prompt; request.compactPrompt = english.prompt; }
  reference = prepared.reference;
  zoneMask = prepared.zoneMask;
  const result = await generateOrReviewRender(parsedSettings.existingImageDataUrl, async () => {
    const image = await getImageAdapterForAction({ organizationId: ctx.organizationId, userId: ctx.userId, projectId, refId: id, batchId: parsedSettings.batchId }, 'render3d');
    return image.generate(request);
  });
  const promptVersion = parsedSettings.existingImageDataUrl ? EXISTING_RENDER_REVIEW_VERSION
    : plan ? SIMPLE_PLAN_PROMPT_VERSION : section ? SIMPLE_SECTION_PROMPT_VERSION : SELECTED_VIEW_IMAGE_PROMPT_VERSION;
  const downloaded = await readRenderBytes(result);
  const candidate = await sanitizeOwnRenderBuffer(downloaded.raw);
  const visibleCandidate = zoneMask
    ? await sanitizeImageBuffer(await isolateZoneResult(candidate, zoneMask)) : candidate;
  const auditReference = interior && prepared.styleAnchor ? { identity: prepared.styleAnchor, interior: true }
    : drone ?? (lateral && prepared.styleAnchor ? { identity: prepared.styleAnchor, lateral: true } : undefined);
  const review = await reviewRenderFidelity(vision, reference, visibleCandidate, view, zoneMask, projectVehicleCount(document),
    options.freedom === 'strict' && !isInteriorRenderMode(options) &&
    (view.preset !== 'custom' || Boolean(view.cutawayWallIds?.length)) && !drone, auditReference, options.redesignFixed,
    redesignRequested && !designReference, spatial, { reference: plan ? 'plan' : section ? 'section' : 'capture', people: options.people,
      ...('sectionRooms' in prepared ? { sectionRooms: prepared.sectionRooms, sectionFurniture: prepared.sectionFurniture } : {}) })
    // Un PNG externo solo se guarda si supera la revisión; una imagen recién generada ya está pagada y no se pierde.
    .catch((error) => { if (parsedSettings.existingImageDataUrl) throw error; return unfinishedRenderReview(error); });
  let finalAsset = { assetUrl: result.assetUrl, assetKey: result.assetKey };
  if (!finalAsset.assetKey && !zoneMask) {
    // El proveedor no pudo copiar el resultado (CDN lenta): se conservan los bytes originales ya descargados para la
    // auditoría antes de que caduque su URL temporal. Si el almacenamiento falla, el entregable queda con esa URL, como antes.
    try {
      const key = `renders/kie/${globalThis.crypto.randomUUID()}.${downloaded.contentType.includes('jpeg') ? 'jpg' : 'png'}`;
      await getStorageAdapter().put({ key, body: downloaded.raw, contentType: downloaded.contentType });
      finalAsset = { assetUrl: await getStorageAdapter().getPresignedDownloadUrl(key), assetKey: key };
    } catch (error) {
      console.warn('[render] No se pudo conservar el resultado en el almacenamiento; se mantiene la URL temporal.', error);
    }
  }
  if (zoneMask) {
    const key = `renders/zones/${globalThis.crypto.randomUUID()}.png`;
    await getStorageAdapter().put({ key, body: Buffer.from(visibleCandidate.base64, 'base64'), contentType: 'image/png' });
    finalAsset = { assetUrl: await getStorageAdapter().getPresignedDownloadUrl(key), assetKey: key };
  }
  await persistDeliverables(projectId, [{
    id,
    type: 'render3d',
    payload: { type: 'render3d', assetUrl: finalAsset.assetUrl, ...(camera ? { camera } : {}), ...(finalAsset.assetKey ? { assetKey: finalAsset.assetKey } : {}),
      generation: { ...result.generation, promptVersion, ...(english?.translated ? { promptLanguage: 'en' as const, sentPrompt: english.prompt } : english?.issue ? { promptTranslationIssue: english.issue } : {}), ...review, documentRevision: document.revision, view, options: generatedOptions, ...(designReference ? { referenceDesignId: designReference.deliverableId } : {}), ...(parsedSettings.batchId ? { batchId: parsedSettings.batchId } : {}) } },
    legalSeal: DELIVERABLE_LEGAL_SEAL,
    version: 1,
  }], undefined, zid, { allowEditorV2: true });
  revalidatePath(`/projects/${projectId}/deliverables`);
  revalidatePath(`/projects/${projectId}/historial`);
  return { id, assetUrl: finalAsset.assetUrl, generation: { ...result.generation, ...review, view, options: generatedOptions,
    documentRevision: document.revision, promptVersion } };
}

/** Estimación local: resuelve la ruta y consulta solo precios explícitos de la allowlist. */
export async function estimateConceptRenderFromEditor(
  projectId: string,
  viewCount: number,
) {
  return runAction(() => estimateConceptRenderFromEditorImpl(projectId, viewCount));
}

async function estimateConceptRenderFromEditorImpl(
  projectId: string,
  viewCount: number,
): Promise<{ estimatedUsd: number; model: string }> {
  const ctx = await requireOrgContext();
  await assertProjectInOrg(ctx, projectId);
  if (!Number.isFinite(viewCount) || !Number.isInteger(viewCount) || viewCount < 1 || viewCount > MAX_RENDER_PASSES)
    fail(`El número de generaciones debe ser un entero entre 1 y ${MAX_RENDER_PASSES}.`);
  const route = (await resolveRoutes('render3d'))[0];
  if (!route) fail('No hay modelo de render configurado.');
  const price = allowedModel('render3d', route.model, route.provider)?.priceUsdPerUnit;
  if (price === undefined || !Number.isFinite(price) || price < 0)
    fail(`No hay precio estimado conocido para ${route.provider}:${route.model}.`);
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
  qualityAck = false,
) {
  return runAction(() =>
    generateViewFrom3DImpl(projectId, captureDataUrl, estilo, aspectRatio, zoneId, qualityAck),
  );
}

async function generateViewFrom3DImpl(
  projectId: string,
  captureDataUrl: string,
  estilo: Estilo,
  aspectRatio: string,
  zoneId: string | null = null,
  qualityAck = false,
): Promise<AgentOutcome> {
  const ctx = await requireOrgContext();
  await assertProjectInOrg(ctx, projectId);
  const zid = await assertZoneInProject(ctx, projectId, zoneId);
  if (!isValidEstilo(estilo)) fail('Estilo no válido');

  // La captura viene del visor 3D, no del documento: la salud estructural se
  // juzga sobre el plano guardado del editor v2. Sin editor v2 activado no hay
  // documento que evaluar y la puerta no aplica.
  const stored = await withEditorDocuments(ctx).load({ projectId, zoneId: zid });
  if (stored.authority === 'v2')
    await assertEditorQuality(
      ctx,
      { projectId, zoneId: zid },
      stored.document,
      qualityAck,
      'vista_3d',
    );

  // La captura llega como data URL ("data:image/png;base64,XXXX"); se extrae el base64.
  const base64 = captureDataUrl.includes(',') ? captureDataUrl.split(',')[1]! : captureDataUrl;
  if (!base64) fail('Captura de la vista 3D vacía');

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
  rawView?: RenderView,
) {
  return runAction(() => saveNativeRenderImpl(projectId, captureDataUrl, zoneId, rawView));
}

async function saveNativeRenderImpl(
  projectId: string,
  captureDataUrl: string,
  zoneId: string | null = null,
  rawView?: RenderView,
): Promise<{ id: string; assetUrl: string }> {
  const ctx = await requireOrgContext();
  await assertProjectInOrg(ctx, projectId);
  const zid = await assertZoneInProject(ctx, projectId, zoneId);
  const camera = rawView ? cameraPoseFromView(renderViewSchema.parse(rawView)) : undefined;
  const match = NATIVE_RENDER_DATA_URL.exec(String(captureDataUrl ?? ''));
  if (!match?.[1]) fail('La captura nativa no tiene un formato PNG válido.');

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
    fail('El almacenamiento de renders no está disponible. Revisa su configuración.');
  }
  await persistDeliverables(
    projectId,
    [{
      id,
      type: 'render3d',
      payload: { type: 'render3d', assetKey, assetUrl, ...(camera ? { camera } : {}) },
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
  await assertLegacyCanvasProjectInOrg(ctx, projectId);
  if (!isValidEstilo(estilo)) fail('Estilo no válido');

  const doc = deserializeCanvas(rawDoc);
  const description = serializeDocToPrompt(doc);
  if (!description) {
    fail('El plano está vacío: añade elementos antes de pedir sugerencias.');
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
  if (!source?.base64) fail('Falta la imagen del plano.');

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
export async function sendPlanoToEditor(projectId: string) {
  return runAction(() => sendPlanoToEditorImpl(projectId));
}

async function sendPlanoToEditorImpl(projectId: string): Promise<void> {
  const ctx = await requireOrgContext();
  // Escribe con autoridad de EDITOR (activa v2 si el proyecto aún vive en el
  // canvas legacy; revisión nueva si ya está activado). No pasa por la puerta
  // legacy: un proyecto ya migrado también puede recibir un plano extraído.
  await assertProjectInOrg(ctx, projectId);
  // El documento enviado procede del estudio guardado, no de un payload cliente.
  const state = await loadStudio(ctx, projectId);
  if (state.sourceKind !== 'drawing' || !state.plano) fail('No hay un boceto extraído para enviar al editor.');
  assertPlanoRasterizable(state.plano);
  await importPlanToEditor(ctx, projectId, {
    plano: state.plano,
    // La vía antigua no guardaba extracción ni cotas confirmadas. Su geometría
    // no adquiere escala física por el mero hecho de abrirse en Editor v2.
    escalaEstimada: state.escalaEstimada !== false,
    writtenDimensions: [],
    corrections: [],
    exteriors: [],
    furniture: [],
    warnings: [],
  });
  await saveStudio(ctx, projectId, { ...state, planImportApplied: true });
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
    if (!res.ok) fail('No se pudo recuperar el plano redibujado del storage.');
    const bytes = Buffer.from(await res.arrayBuffer());
    return {
      base64: bytes.toString('base64'),
      mimeType: res.headers.get('content-type') ?? 'image/png',
    };
  }
  fail('URL de imagen no permitida.');
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
  qualityAck = false,
): Promise<{ imageUrl: string }> {
  const ctx = await requireOrgContext();
  await assertProjectInOrg(ctx, projectId);
  await assertTosAccepted(ctx.userId);
  if (!isValidEstilo(estilo)) fail('Estilo no válido');

  // Puerta de calidad antes de resolver el adaptador de imagen: el veredicto del
  // plano se lee del estado del estudio en el servidor, no del cliente.
  await assertStudioPlanQuality(
    ctx,
    projectId,
    await loadStudio(ctx, projectId),
    qualityAck === true,
    'cenital_redibujado',
  );

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
  qualityAck = false,
): Promise<{ imageUrl: string }> {
  const ctx = await requireOrgContext();
  await assertProjectInOrg(ctx, projectId);
  await assertTosAccepted(ctx.userId);
  if (!isValidEstilo(estilo)) fail('Estilo no válido');

  // El plano llega del cliente, pero la fiabilidad NO: la decide el veredicto
  // guardado del estudio, antes de resolver el adaptador y de cobrar.
  await assertStudioPlanQuality(
    ctx,
    projectId,
    await loadStudio(ctx, projectId),
    qualityAck === true,
    'cenital_plano',
  );

  const image = await getImageAdapterForAction({ organizationId: ctx.organizationId }, 'render3d');
  const result = await generateCenital({ image }, plano, estilo);
  return { imageUrl: result.assetUrl };
}
