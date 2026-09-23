/**
 * Orquestador del feedback por zona: a partir de una zona e instrucción, genera
 * una nueva versión del entregable modificando SOLO esa zona, cobrando con el
 * patrón reserva/confirma/revierte.
 *
 * Despacha según el tipo del entregable: un render se regenera por inpainting de
 * la zona; un plano se regenera parcialmente sustituyendo el subárbol de la zona.
 * El cobro usa una clave idempotente por operación, de modo que un reintento de la
 * misma iteración no cobra dos veces.
 */
import type {
  ImageAdapter,
  DebitService,
  CanvasZone,
  Plano2dPayload,
  PlanZone,
  InpaintRequest,
} from '@/lib/contracts';
import type { Prisma } from '@/generated/prisma/client';
import { resolveZone } from './zone-resolver';
import { buildInpaintZone } from './mask-builder';
import { directedInpaint } from './directed-inpaint';
import { replaceZone } from './partial-plan-editor';
import {
  loadDeliverable,
  createIteration,
  countIterations,
  type IterationResult,
} from './iteration-repo';
import { agentError } from '../errors';

export interface FeedbackDeps {
  image: ImageAdapter;
  debit: DebitService;
  /** Regenera el subárbol de una zona del plano (structured output del fragmento). */
  regenerateZone: (instruction: string, zoneId: string, current?: PlanZone) => Promise<PlanZone>;
  /**
   * Imagen base del render a retocar. Sin él se usa la `assetUrl` guardada, que es
   * una presignada que caduca: el llamador con acceso al storage debe aportarlo.
   */
  loadRenderBase?: (payload: unknown) => Promise<InpaintRequest['baseImage']>;
  /** Reescribe la memoria de materiales según la instrucción; sin él no es iterable. */
  reviseMemoria?: (markdown: string, instruction: string) => Promise<string>;
}

export interface FeedbackInput {
  organizationId: string;
  deliverableId: string;
  zone: CanvasZone;
  instruction: string;
  /** Para planos: id de la zona del plano a regenerar. */
  planZoneId?: string;
  estimateCredits: number;
  /**
   * Id único de ESTE intento (lo genera el servidor por invocación). Es la clave
   * idempotente del cobro: repetir la misma instrucción sobre el mismo diseño es otra
   * operación y se cobra; un reintento de red con el mismo id, no.
   */
  attemptId?: string;
}

export async function runFeedback(
  deps: FeedbackDeps,
  input: FeedbackInput,
): Promise<IterationResult> {
  const deliverable = await loadDeliverable(input.organizationId, input.deliverableId);
  // Sin `attemptId` (endpoint del lienzo), el nº de iteraciones ya registradas separa
  // un intento nuevo de uno repetido: la versión del diseño base no cambia nunca.
  const attempt = input.attemptId ?? `n${await countIterations(input.deliverableId)}:${hash(input.instruction)}`;
  const idempotencyKey = `iterate:${input.deliverableId}:${attempt}`;

  const hold = await deps.debit.hold(idempotencyKey, {
    kind: 'tokens',
    usage: { promptTokens: input.estimateCredits, completionTokens: 0 },
  });

  try {
    const { payload, type } = await regenerate(deps, input, deliverable);
    const result = await createIteration({
      organizationId: input.organizationId,
      deliverableId: input.deliverableId,
      zone: input.zone as unknown as Prisma.InputJsonValue,
      instruction: input.instruction,
      newPayload: payload,
      newType: type,
    });
    await deps.debit.settle(hold, {
      kind: 'tokens',
      usage: { promptTokens: input.estimateCredits, completionTokens: 0 },
    });
    return result;
  } catch (err) {
    // El error que ve el usuario es siempre el original, aunque liberar la reserva falle.
    await deps.debit.revert(hold).catch(() => undefined);
    throw err;
  }
}

async function regenerate(
  deps: FeedbackDeps,
  input: FeedbackInput,
  deliverable: { type: string; payload: unknown },
): Promise<{ payload: Prisma.InputJsonValue; type: string }> {
  if (deliverable.type === 'RENDER_3D' || deliverable.type === 'render3d') {
    const box = resolveZone(input.zone);
    const zone = buildInpaintZone({ zoneId: input.zone.id, box, maskRef: input.zone.maskRef });
    const baseImage = deps.loadRenderBase
      ? await deps.loadRenderBase(deliverable.payload)
      : { url: readRenderUrl(deliverable.payload) };
    const result = await directedInpaint(deps.image, {
      baseImage,
      zone,
      instruction: input.instruction,
    });
    return {
      // Igual que en la entrega: se guarda `assetKey` (si lo hay) para re-firmar la
      // URL al servir; la presignada de `assetUrl` caduca.
      payload: {
        type: 'render3d',
        assetUrl: result.assetUrl,
        ...(result.assetKey ? { assetKey: result.assetKey } : {}),
      } as Prisma.InputJsonValue,
      type: 'render3d',
    };
  }

  if (deliverable.type === 'PLANO_2D' || deliverable.type === 'plano2d') {
    if (!input.planZoneId) throw agentError('phase_guard', 'Falta la zona del plano a regenerar');
    const plano = readPlano(deliverable.payload);
    const current = plano.zones.find((z) => z.id === input.planZoneId);
    if (!current) throw agentError('phase_guard', 'La zona del plano no existe');
    const regenerated = await deps.regenerateZone(input.instruction, input.planZoneId, current);
    const next = replaceZone(plano, input.planZoneId, regenerated);
    return {
      payload: { type: 'plano2d', plano: next } as unknown as Prisma.InputJsonValue,
      type: 'plano2d',
    };
  }

  if ((deliverable.type === 'MEMORIA' || deliverable.type === 'memoria') && deps.reviseMemoria) {
    const markdown = (deliverable.payload as { markdown?: unknown })?.markdown;
    if (typeof markdown !== 'string') throw agentError('schema_repair_failed', 'Memoria inválida');
    const revised = await deps.reviseMemoria(markdown, input.instruction);
    if (!revised.trim()) throw agentError('schema_repair_failed', 'La memoria revisada llegó vacía');
    return {
      payload: { type: 'memoria', markdown: revised } as Prisma.InputJsonValue,
      type: 'memoria',
    };
  }

  throw agentError('phase_guard', `Tipo de entregable no iterable: ${deliverable.type}`);
}

function readRenderUrl(payload: unknown): string {
  const p = payload as { assetUrl?: string };
  if (!p?.assetUrl) throw agentError('schema_repair_failed', 'El render no tiene assetUrl');
  return p.assetUrl;
}

function readPlano(payload: unknown): Plano2dPayload {
  const p = payload as { plano?: Plano2dPayload } | Plano2dPayload;
  const plano = (p as { plano?: Plano2dPayload }).plano ?? (p as Plano2dPayload);
  if (!Array.isArray(plano?.zones)) throw agentError('schema_repair_failed', 'Plano inválido');
  return plano;
}

// Hash estable y corto de la instrucción para distinguir operaciones distintas.
function hash(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
