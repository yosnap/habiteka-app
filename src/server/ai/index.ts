/**
 * Punto de entrada de la capa de IA.
 *
 * Las factories devuelven adaptadores que satisfacen los contratos de F0 con el
 * guardia de gasto ya cableado: cada llamada pasa por `assertCanSpend` (frecuencia
 * + cap diario + cortacircuitos) antes de tocar al proveedor, y registra el
 * resultado para el cortacircuitos. La clave del proveedor nunca sale de aquí.
 */
import type {
  ChatVisionAdapter,
  ChatRequest,
  ChatResult,
  ChatDelta,
  ImageAdapter,
  ImageGenRequest,
  InpaintRequest,
  ImageResult,
} from '@/lib/contracts';
import type { ModelAction } from '@/generated/prisma/enums';
import { OpenRouterChatVisionAdapter } from './chat-vision-adapter';
import { ProviderImageAdapter, createActiveProvider } from './image/provider-image-adapter';
import { KieImageProvider } from './image/providers/kie-image';
import { OpenAiImageProvider } from './image/providers/openai-image';
import { resolveKieKey, resolveProviderKey } from './provider-key-resolver';
import { getStorageAdapter } from '@/server/storage/s3-storage-adapter';
import { resolveRoutes, type ResolvedRoute } from './model-routing';
import { AiError, canFailover } from './errors';
import { assertCanSpend, recordOutcome } from './guard/spend-guard';
import { enforceModelJurisdiction } from '@/server/privacy/jurisdiction-allowlist';
import { randomUUID } from 'node:crypto';
import { aiErrorCode, recordAiAttempt, type AiCostScope } from '@/server/analytics/ai-cost-recorder';
import { allowedModel } from '@/server/admin/config/model-allowlist';
import { chatAttemptCost } from './cost/chat-attempt-cost';

// Estimaciones de coste por llamada para el guardia (USD). Conservadoras: el
// coste real medido lo aporta la respuesta y lo concilia la facturación.
const CHAT_ESTIMATE_USD = 0.05;
const IMAGE_ESTIMATE_USD = 0.05;

export type AiCallContext = AiCostScope;

/** Adaptador de chat/visión con el modelo resuelto por acción y guardia de gasto. */
export async function getChatVisionAdapter(
  ctx: AiCallContext,
  action: ModelAction,
): Promise<ChatVisionAdapter> {
  const routes = (await resolveRoutes(action)).filter((route) => route.provider !== 'kie' && route.provider !== 'openai');
  if (routes.length === 0) throw new AiError('provider_down', `No hay ruta de chat compatible para ${action}`);

  return {
    async chat(req: ChatRequest): Promise<ChatResult> {
      assertCanSpend(ctx.organizationId, CHAT_ESTIMATE_USD);
      // Transferencia internacional lícita (RGPD art. 44): si hay allowlist de
      // jurisdicción configurada, el modelo elegido debe estar en ella.
      try {
        const result = await withChatFailover(ctx, action, routes, req, (adapter, routed) => adapter.chat(routed));
        recordOutcome(ctx.organizationId, true);
        return result;
      } catch (err) {
        recordOutcome(ctx.organizationId, false);
        throw err;
      }
    },
    async *chatStream(req: ChatRequest): AsyncIterable<ChatDelta> {
      assertCanSpend(ctx.organizationId, CHAT_ESTIMATE_USD);
      try {
        yield* streamWithChatFailover(ctx, action, routes, req);
        recordOutcome(ctx.organizationId, true);
      } catch (err) {
        recordOutcome(ctx.organizationId, false);
        throw err;
      }
    },
  };
}

/**
 * Adaptador de imagen con el MODELO resuelto por acción (config del back-office)
 * además del guardia de gasto. Cierra la deuda de modelos de imagen hardcodeados:
 * la acción (p. ej. `render3d`) decide el slug que usa el proveedor activo.
 */
export async function getImageAdapterForAction(
  ctx: AiCallContext,
  action: ModelAction,
): Promise<ImageAdapter> {
  const routes = (await resolveRoutes(action)).filter((route) => route.provider !== 'nan');
  if (routes.length === 0) throw new AiError('provider_down', `No hay ruta de imagen compatible para ${action}`);
  return wrapImageAdapter(ctx, action, new FailoverImageAdapter(ctx, action, routes));
}

/** Adaptador de imagen con guardia de gasto y proveedor activo (modelo por defecto). */
export async function getImageAdapter(ctx: AiCallContext): Promise<ImageAdapter> {
  return getImageAdapterForAction(ctx, 'render3d');
}

// Envuelve un adaptador de imagen con el guardia de gasto y el cortacircuitos.
function wrapImageAdapter(ctx: AiCallContext, _action: ModelAction, inner: ImageAdapter): ImageAdapter {

  return {
    async generate(req: ImageGenRequest): Promise<ImageResult> {
      assertCanSpend(ctx.organizationId, IMAGE_ESTIMATE_USD);
      try {
        const result = await inner.generate(req);
        recordOutcome(ctx.organizationId, true);
        return result;
      } catch (err) {
        recordOutcome(ctx.organizationId, false);
        throw err;
      }
    },
    async inpaint(req: InpaintRequest): Promise<ImageResult> {
      assertCanSpend(ctx.organizationId, IMAGE_ESTIMATE_USD);
      try {
        const result = await inner.inpaint(req);
        recordOutcome(ctx.organizationId, true);
        return result;
      } catch (err) {
        recordOutcome(ctx.organizationId, false);
        throw err;
      }
    },
  };
}

async function createImageAdapter(route: ResolvedRoute): Promise<ImageAdapter> {
  if (route.provider === 'kie') {
    let storage;
    try { storage = getStorageAdapter(); } catch { storage = undefined; }
    return new ProviderImageAdapter(new KieImageProvider(await resolveKieKey(), storage, route.model));
  }
  if (route.provider === 'openai') {
    let storage;
    try { storage = getStorageAdapter(); } catch { storage = undefined; }
    return new ProviderImageAdapter(new OpenAiImageProvider(await resolveProviderKey('openai'), storage));
  }
  enforceModelJurisdiction(route.model);
  return new ProviderImageAdapter(createActiveProvider(route.model, await resolveProviderKey('openrouter')));
}

async function withChatFailover<T extends ChatResult>(
  ctx: AiCallContext, action: ModelAction, routes: ResolvedRoute[], req: ChatRequest,
  invoke: (adapter: OpenRouterChatVisionAdapter, routed: ChatRequest) => Promise<T>,
): Promise<T> {
  const requestId = randomUUID();
  let lastError: unknown;
  for (const [attempt, route] of routes.entries()) {
    const started = performance.now();
    const model = req.model || route.model;
    try {
      enforceModelJurisdiction(model);
      const apiKey = await resolveProviderKey(route.provider);
      const adapter = new OpenRouterChatVisionAdapter({ baseURL: route.baseURL, apiKey, reportsUsd: route.provider === 'openrouter' });
      // El failover se ejecuta aquí, intento a intento. No delegarlo al gateway:
      // ocultaría qué proveedor/modelo respondió y rompería la trazabilidad real.
      const result = await invoke(adapter, { ...req, model, fallbackModels: undefined });
      const usage = result.usage;
      await recordAiAttempt({ ...ctx, requestId, attempt, action, operation: action === 'vision' ? 'vision' : 'chat', provider: route.provider, model, status: 'success', latencyMs: elapsed(started), units: usage ? { promptTokens: usage.promptTokens, completionTokens: usage.completionTokens } : undefined, ...chatAttemptCost(usage) });
      return result;
    } catch (error) {
      lastError = error;
      await recordAiAttempt({ ...ctx, requestId, attempt, action, operation: action === 'vision' ? 'vision' : 'chat', provider: route.provider, model, status: 'error', latencyMs: elapsed(started), costType: 'unknown', errorCode: aiErrorCode(error) });
      if (!canFailover(error)) throw error;
    }
  }
  throw lastError;
}

async function* streamWithChatFailover(ctx: AiCallContext, action: ModelAction, routes: ResolvedRoute[], req: ChatRequest): AsyncIterable<ChatDelta> {
  const requestId = randomUUID();
  let lastError: unknown;
  for (const [attempt, route] of routes.entries()) {
    let emitted = false;
    let recorded = false;
    let units: { promptTokens: number; completionTokens: number; reportedCostUsd?: number } | undefined;
    const started = performance.now();
    const model = req.model || route.model;
    try {
      enforceModelJurisdiction(model);
      const apiKey = await resolveProviderKey(route.provider);
      const adapter = new OpenRouterChatVisionAdapter({ baseURL: route.baseURL, apiKey, reportsUsd: route.provider === 'openrouter' });
      for await (const delta of adapter.chatStream({ ...req, model, fallbackModels: undefined })) {
        emitted = true;
        if (delta.usage) units = delta.usage;
        yield delta;
      }
      await recordAiAttempt({ ...ctx, requestId, attempt, action, operation: action === 'vision' ? 'vision' : 'chat', provider: route.provider, model, status: 'success', latencyMs: elapsed(started), units, ...chatAttemptCost(units) });
      recorded = true;
      return;
    } catch (error) {
      lastError = error;
      await recordAiAttempt({ ...ctx, requestId, attempt, action, operation: action === 'vision' ? 'vision' : 'chat', provider: route.provider, model, status: 'error', latencyMs: elapsed(started), units, costType: 'unknown', errorCode: aiErrorCode(error) });
      recorded = true;
      if (emitted || !canFailover(error)) throw error;
    } finally {
      // Si el consumidor cancela el stream después del primer delta, el intento
      // existió pero no hay coste final fiable ni respuesta completa.
      if (!recorded) await recordAiAttempt({ ...ctx, requestId, attempt, action, operation: action === 'vision' ? 'vision' : 'chat', provider: route.provider, model, status: 'error', latencyMs: elapsed(started), units, costType: 'unknown', errorCode: 'stream_cancelled' });
    }
  }
  throw lastError;
}

class FailoverImageAdapter implements ImageAdapter {
  constructor(private readonly ctx: AiCallContext, private readonly action: ModelAction, private readonly routes: ResolvedRoute[]) {}

  generate(req: ImageGenRequest): Promise<ImageResult> {
    return this.run('generate', (adapter) => adapter.generate(req));
  }

  inpaint(req: InpaintRequest): Promise<ImageResult> {
    return this.run('inpaint', (adapter) => adapter.inpaint(req));
  }

  private async run(operationName: 'generate' | 'inpaint', operation: (adapter: ImageAdapter) => Promise<ImageResult>): Promise<ImageResult> {
    const requestId = randomUUID();
    let lastError: unknown;
    for (const [attempt, route] of this.routes.entries()) {
      const started = performance.now();
      try {
        const result = await operation(await createImageAdapter(route));
        // Misma tarifa estimada que la previsualización; nunca importe facturado.
        const costUsd = allowedModel(this.action, route.model, route.provider)?.priceUsdPerUnit ?? result.cost.amountUsd;
        await recordAiAttempt({ ...this.ctx, requestId, attempt, action: this.action, operation: operationName, provider: route.provider, model: route.model, status: 'success', latencyMs: elapsed(started), units: { images: 1, unit: result.cost.unit }, costUsd, costType: 'estimated' });
        return { ...result, generation: { provider: route.provider, model: route.model, fallbackIndex: attempt } };
      }
      catch (error) {
        lastError = error;
        const providerTaskId = (error as { providerTaskId?: unknown } | null)?.providerTaskId;
        await recordAiAttempt({ ...this.ctx, requestId, attempt, action: this.action, operation: operationName, provider: route.provider, model: route.model, status: 'error', latencyMs: elapsed(started), units: typeof providerTaskId === 'string' ? { providerTaskId } : undefined, costType: 'unknown', errorCode: aiErrorCode(error) });
        if (!canFailover(error)) throw error;
      }
    }
    throw lastError;
  }
}

function elapsed(started: number): number {
  return Math.max(0, Math.round(performance.now() - started));
}

export { invalidate as invalidateModelConfig } from './model-config-loader';
export { AiError } from './errors';
