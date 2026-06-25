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
import { getChatVisionAdapter } from '@/server/ai';
import { recommendDecoration as runRecommend } from '@/server/agent/phases/decoracion';
import { detectLayout } from '@/server/agent/phases/deteccion-layout';
import { assertConsent } from '@/server/privacy/consent-service';
import { assertTosAccepted } from '@/server/legal/tos-acceptance-service';
import { deserializeCanvas } from '@/canvas/serialize';
import { serializeDocToPrompt } from '@/canvas/serialize-doc-to-prompt';
import { rasterizeCanvasDoc } from '@/server/agent/canvas/rasterize-canvas-doc';
import { isValidEstilo, isValidEntregable } from '@/lib/design-options';
import type {
  DeliverableType,
  Estilo,
  DecorRecommendation,
  DetectedObject,
  MessagePart,
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
