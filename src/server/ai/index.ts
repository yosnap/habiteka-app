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
import { resolveRoute } from './model-routing';
import { assertCanSpend, recordOutcome } from './guard/spend-guard';

// Estimaciones de coste por llamada para el guardia (USD). Conservadoras: el
// coste real medido lo aporta la respuesta y lo concilia la facturación.
const CHAT_ESTIMATE_USD = 0.05;
const IMAGE_ESTIMATE_USD = 0.05;

export interface AiCallContext {
  organizationId: string;
}

/** Adaptador de chat/visión con el modelo resuelto por acción y guardia de gasto. */
export async function getChatVisionAdapter(
  ctx: AiCallContext,
  action: ModelAction,
): Promise<ChatVisionAdapter> {
  const route = await resolveRoute(action);
  const inner = new OpenRouterChatVisionAdapter({ baseURL: route.baseURL });

  return {
    async chat(req: ChatRequest): Promise<ChatResult> {
      assertCanSpend(ctx.organizationId, CHAT_ESTIMATE_USD);
      try {
        const result = await inner.chat(withRoute(req, route));
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
        yield* inner.chatStream(withRoute(req, route));
        recordOutcome(ctx.organizationId, true);
      } catch (err) {
        recordOutcome(ctx.organizationId, false);
        throw err;
      }
    },
  };
}

/** Adaptador de imagen con guardia de gasto y proveedor activo. */
export function getImageAdapter(ctx: AiCallContext): ImageAdapter {
  const inner = new ProviderImageAdapter(createActiveProvider());

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

// Aplica el modelo primario y los respaldos resueltos por la config al request.
function withRoute(
  req: ChatRequest,
  route: { primaryModel: string; fallbacks: string[] },
): ChatRequest {
  return {
    ...req,
    model: req.model || route.primaryModel,
    fallbackModels: req.fallbackModels ?? route.fallbacks,
  };
}

export { invalidate as invalidateModelConfig } from './model-config-loader';
export { AiError } from './errors';
