'use server';

/**
 * Server Actions finas que conectan la UI con el orquestador del agente. No
 * contienen lógica de negocio ni prompts: resuelven la organización de la sesión,
 * crean la sesión de agente y delegan en `advance`. La IA y las guardas viven en
 * el servidor (F5/F3).
 */
import { requireOrgContext } from '@/server/auth/require-org-context';
import type { OrgContext } from '@/server/auth/org-context';
import { withOrg } from '@/server/db/scoped-repo';
import { getStorageAdapter } from '@/server/storage/s3-storage-adapter';
import { persistSourceImage } from '@/server/agent/persistence/source-image-repo';
import {
  getAgent,
  type AgentInput,
  type AgentOutcome,
  type ZoneDeliveryContext,
} from '@/server/agent';
import { getChatVisionAdapter, getImageAdapterForAction } from '@/server/ai';
import { assertPlanoRasterizable, generateCenital } from '@/server/ai/design/cenital-pipeline';
import { planoToDoc } from '@/canvas/plano-to-doc';
import { redrawPlan } from '@/server/ai/design/redraw-plan-pipeline';
import { recommendDecoration as runRecommend } from '@/server/agent/phases/decoracion';
import { detectLayout } from '@/server/agent/phases/deteccion-layout';
import { extractSketchGeometry } from '@/server/ai/sketch/extract-sketch-geometry';
import { normalizeSketch } from '@/server/ai/sketch/normalize-geometry';
import { detectWallsFromImage } from '@/server/plan/detect-walls-raster';
import { assertConsent } from '@/server/privacy/consent-service';
import { assertTosAccepted } from '@/server/legal/tos-acceptance-service';
import { deserializeCanvas, serializeCanvas } from '@/canvas/serialize';
import { serializeDocToPrompt } from '@/canvas/serialize-doc-to-prompt';
import { rasterizeCanvasDoc } from '@/server/agent/canvas/rasterize-canvas-doc';
import { isValidEstilo, isValidEntregable } from '@/lib/design-options';
import type {
  DeliverableType,
  Estilo,
  DecorRecommendation,
  DetectedObject,
  MessagePart,
  Plano2dPayload,
  SketchPlanResult,
} from '@/lib/contracts';

/**
 * Verifica que el proyecto pertenece a la organización de la sesión. El agente
 * (`loadState`/`persistDeliverables`) opera por `projectId` sin acotar org, así que
 * la pertenencia se valida AQUÍ, en la única puerta de entrada, antes de delegar.
 */
async function assertProjectInOrg(ctx: OrgContext, projectId: string): Promise<void> {
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
  await assertProjectInOrg(ctx, projectId);
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
  await assertProjectInOrg(ctx, projectId);
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
 * Convierte un boceto (foto de dibujo a mano o croquis) en un plano 2D métrico
 * normalizado. La IA solo extrae la geometría; la ortogonalización, el cierre de
 * esquinas y la escala a milímetros son deterministas (mismo boceto extraído →
 * mismo plano). Mismo deber RGPD que la detección: consentimiento + ToS, y
 * acotado por organización.
 */
export async function extractPlanFromSketch(
  projectId: string,
  imageParts: MessagePart[],
): Promise<SketchPlanResult> {
  const ctx = await requireOrgContext();
  await assertProjectInOrg(ctx, projectId);
  await assertConsent(ctx.userId, 'IMAGE_PROCESSING');
  await assertTosAccepted(ctx.userId);
  return extractPlanCore(ctx.organizationId, imageParts);
}

/**
 * Extrae la geometría desde el plano REDIBUJADO (no desde la foto original):
 * el redibujado normaliza la imagen a muros negros macizos sobre fondo blanco,
 * exactamente el formato donde la detección de píxeles es precisa — la foto
 * original (líneas finas, ruido) forzaba el fallback al modelo, que estima
 * coordenadas a ojo. Acepta solo data URLs o URLs de NUESTRO storage (nada de
 * traer URLs arbitrarias al servidor).
 */
export async function extractPlanFromRedrawn(
  projectId: string,
  imageUrl: string,
): Promise<SketchPlanResult> {
  const ctx = await requireOrgContext();
  await assertProjectInOrg(ctx, projectId);
  await assertConsent(ctx.userId, 'IMAGE_PROCESSING');
  await assertTosAccepted(ctx.userId);

  const image = await imageBytesFromTrustedUrl(imageUrl);
  return extractPlanCore(ctx.organizationId, [
    { type: 'image_url', base64: image.base64, mimeType: image.mimeType },
  ]);
}

/** Resuelve los bytes de la imagen redibujada: data URL o asset de nuestro storage. */
async function imageBytesFromTrustedUrl(url: string): Promise<{ base64: string; mimeType: string }> {
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

async function extractPlanCore(
  organizationId: string,
  imageParts: MessagePart[],
): Promise<SketchPlanResult> {
  const chat = await getChatVisionAdapter({ organizationId }, 'vision');
  // Geometría por dos vías en paralelo: el modelo (semántica: habitaciones,
  // aberturas, escala) y la detección de píxeles (muros con posición EXACTA;
  // el modelo estima coordenadas a ojo y desplaza habitaciones enteras). Si la
  // imagen no es un plano nítido, la detección devuelve poco y se cae al modelo.
  const firstBase64 = imageParts.find(
    (p): p is Extract<MessagePart, { type: 'image_url' }> => p.type === 'image_url',
  )?.base64;
  const [raw, detected] = await Promise.all([
    extractSketchGeometry(chat, imageParts),
    firstBase64
      ? detectWallsFromImage(Buffer.from(firstBase64, 'base64')).catch(() => null)
      : Promise.resolve(null),
  ]);
  if (raw.muros.length === 0 && (detected?.walls.length ?? 0) < 4) {
    throw new Error('No se reconocieron muros en el boceto: prueba con una foto más nítida en planta.');
  }
  // La escala solo es un dato real si sale de medidas ESCRITAS en el boceto;
  // en cualquier otro caso es conjetura y la UI no debe pintarla como cotas.
  return {
    plano: normalizeSketch(raw, {
      wallsOverride: detected?.walls,
      // El aspecto del plano es un DATO de la imagen, no una estimación.
      imageHeightOverWidth: detected?.heightOverWidth,
    }),
    escalaEstimada: raw.escalaFiable !== true,
  };
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
  await assertProjectInOrg(ctx, projectId);
  // Mismas cotas de cordura que el resto de consumidores del payload cliente.
  assertPlanoRasterizable(plano);

  const { objects, scale } = planoToDoc(plano);
  // Documento nuevo normalizado por el (de)serializador: solo entra lo válido.
  const empty = deserializeCanvas(null);
  const doc = serializeCanvas({ ...empty, objects, scale });
  await withOrg(ctx).canvas.save(projectId, doc, null);
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
