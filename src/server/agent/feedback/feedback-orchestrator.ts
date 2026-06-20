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
} from '@/lib/contracts';
import type { Prisma } from '@/generated/prisma/client';
import { resolveZone } from './zone-resolver';
import { buildInpaintZone } from './mask-builder';
import { directedInpaint } from './directed-inpaint';
import { replaceZone } from './partial-plan-editor';
import { loadDeliverable, createIteration, type IterationResult } from './iteration-repo';
import { agentError } from '../errors';

export interface FeedbackDeps {
  image: ImageAdapter;
  debit: DebitService;
  /** Regenera el subárbol de una zona del plano (structured output del fragmento). */
  regenerateZone: (instruction: string, zoneId: string) => Promise<PlanZone>;
}

export interface FeedbackInput {
  organizationId: string;
  deliverableId: string;
  zone: CanvasZone;
  instruction: string;
  /** Para planos: id de la zona del plano a regenerar. */
  planZoneId?: string;
  estimateCredits: number;
}

export async function runFeedback(
  deps: FeedbackDeps,
  input: FeedbackInput,
): Promise<IterationResult> {
  const deliverable = await loadDeliverable(input.organizationId, input.deliverableId);
  const idempotencyKey = `iterate:${input.deliverableId}:v${deliverable.version}:${hash(input.instruction)}`;

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
    await deps.debit.revert(hold);
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
    const baseAssetUrl = readRenderUrl(deliverable.payload);
    const result = await directedInpaint(deps.image, {
      baseAssetUrl,
      zone,
      instruction: input.instruction,
    });
    return {
      payload: { type: 'render3d', assetUrl: result.assetUrl } as Prisma.InputJsonValue,
      type: 'render3d',
    };
  }

  if (deliverable.type === 'PLANO_2D' || deliverable.type === 'plano2d') {
    if (!input.planZoneId) throw agentError('phase_guard', 'Falta la zona del plano a regenerar');
    const plano = readPlano(deliverable.payload);
    const regenerated = await deps.regenerateZone(input.instruction, input.planZoneId);
    const next = replaceZone(plano, input.planZoneId, regenerated);
    return {
      payload: { type: 'plano2d', plano: next } as unknown as Prisma.InputJsonValue,
      type: 'plano2d',
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
