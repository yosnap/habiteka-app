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
import { getAgent, type AgentInput, type AgentOutcome } from '@/server/agent';
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

export async function advanceAgent(projectId: string, input: AgentInput): Promise<AgentOutcome> {
  const ctx = await requireOrgContext();
  await assertProjectInOrg(ctx, projectId);

  // La imagen de origen se persiste en esta capa (la que posee el scope de org),
  // no en el orquestador (deliberadamente org-agnóstico). Solo en la ingesta y
  // solo si trae bytes embebidos; el gate de consentimiento del orquestador corta
  // el procesamiento aguas abajo si falta base legal.
  if (input.action === 'ingest') {
    await assertConsent(ctx.userId, 'IMAGE_PROCESSING');
    await persistIngestImages(ctx, projectId, input.image);
  }

  const agent = await getAgent(ctx.organizationId, ctx.userId, (pid) =>
    withOrg(ctx).sourceImages.latestPrimaryId(pid),
  );
  return agent.advance(projectId, input);
}

/** Persiste las imágenes embebidas de la ingesta como SourceImage (scope org). */
async function persistIngestImages(
  ctx: OrgContext,
  projectId: string,
  parts: MessagePart[],
): Promise<void> {
  const repo = withOrg(ctx);
  const storage = getStorageAdapter();
  for (const part of parts) {
    if (part.type !== 'image_url' || !part.base64) continue;
    const body = Buffer.from(part.base64, 'base64');
    await persistSourceImage(repo, storage, {
      organizationId: ctx.organizationId,
      projectId,
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
): Promise<AgentOutcome> {
  const ctx = await requireOrgContext();
  await assertProjectInOrg(ctx, projectId);
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

  // El lienzo rasterizado no es una imagen de origen del usuario, así que la
  // generación desde el lienzo no vincula trazabilidad (resolver a null).
  const agent = await getAgent(ctx.organizationId, ctx.userId, async () => null);
  return agent.advance(projectId, {
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
  });
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
