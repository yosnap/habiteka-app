/**
 * Conmutación de gateway ante caída del primario.
 *
 * El fallback de modelos de OpenRouter no cubre que OpenRouter mismo caiga (es un
 * punto único de fallo). Esta utilidad ejecuta una operación contra el gateway
 * primario y, si responde con error de servidor o de red, la reintenta una vez
 * contra un gateway secundario configurado. El orden lo decide el entorno.
 */
import type OpenAI from 'openai';
import { getGatewayClient } from './gateway-client';
import { aiError } from '../errors';

export interface GatewayCall<T> {
  baseURL: string | null;
  run: (client: OpenAI) => Promise<T>;
}

function isServerOrNetworkError(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  // 5xx del gateway o ausencia de status (error de red) ⇒ conmutar.
  return status === undefined || status >= 500;
}

/**
 * Ejecuta la operación contra el gateway primario; si cae con 5xx/red, reintenta
 * contra el secundario (`OPENROUTER_FALLBACK_BASE_URL`). Si no hay secundario o
 * también falla, lanza `AiError('gateway_down')`.
 */
export async function withGatewayFallback<T>(call: GatewayCall<T>): Promise<T> {
  try {
    return await call.run(getGatewayClient({ baseURL: call.baseURL }));
  } catch (primaryErr) {
    if (!isServerOrNetworkError(primaryErr)) {
      throw primaryErr;
    }
    const secondary = process.env.OPENROUTER_FALLBACK_BASE_URL;
    if (!secondary) {
      throw aiError(
        'gateway_down',
        'Gateway primario caído y sin secundario configurado',
        primaryErr,
      );
    }
    try {
      return await call.run(getGatewayClient({ baseURL: secondary }));
    } catch (secondaryErr) {
      throw aiError('gateway_down', 'Gateways primario y secundario caídos', secondaryErr);
    }
  }
}
