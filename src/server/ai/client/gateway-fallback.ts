/**
 * Conmutación de gateway ante caída del primario.
 *
 * Cada ruta de modelo tiene su proveedor y los respaldos se resuelven por la
 * capa superior. Esta utilidad normaliza los fallos de red/servidor del gateway
 * actual como `gateway_down`, sin depender de variables globales.
 */
import type OpenAI from 'openai';
import { getGatewayClient } from './gateway-client';
import { APIConnectionTimeoutError, APIUserAbortError } from 'openai';
import { aiError } from '../errors';

export interface GatewayCall<T> {
  baseURL: string | null;
  apiKey?: string;
  run: (client: OpenAI) => Promise<T>;
}

function isServerOrNetworkError(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  // 5xx del gateway o ausencia de status (error de red) ⇒ conmutar.
  return status === undefined || status >= 500;
}

/**
 * Ejecuta la operación contra el gateway configurado y normaliza su caída para
 * que la cadena proveedor+modelo pueda probar el siguiente respaldo.
 */
export const NO_CREDIT_MESSAGE = 'El proveedor de IA se ha quedado sin saldo. Recárgalo o elige otro modelo en Modelos por uso.';

/** Máximo que se espera a un modelo antes de pasar al respaldo: un plano normal tarda entre 30 s y 2 min. */
export const MODEL_TIMEOUT_MS = 180_000;

export async function withGatewayFallback<T>(call: GatewayCall<T>): Promise<T> {
  try {
    return await call.run(getGatewayClient({ baseURL: call.baseURL, apiKey: call.apiKey }));
  } catch (primaryErr) {
    // Sin saldo en el proveedor: pasa al respaldo configurado y, si es el último, se dice claro.
    if ((primaryErr as { status?: number })?.status === 402) {
      throw aiError('provider_down', NO_CREDIT_MESSAGE, primaryErr);
    }
    // Tope de espera agotado (AbortSignal.timeout o el `timeout` del SDK): se pasa al respaldo.
    // El SDK no pone `name` a sus errores: se reconocen por su clase.
    if (primaryErr instanceof APIUserAbortError || primaryErr instanceof APIConnectionTimeoutError || (primaryErr as { name?: string } | null)?.name === 'TimeoutError') {
      throw aiError('timeout', `El modelo no respondió en ${MODEL_TIMEOUT_MS / 60_000} minutos`, primaryErr);
    }
    if ((primaryErr as { status?: number })?.status === 429) {
      throw aiError('rate_limit', 'El modelo está temporalmente saturado; probando la ruta de respaldo', primaryErr);
    }
    if (!isServerOrNetworkError(primaryErr)) {
      throw primaryErr;
    }
    throw aiError('gateway_down', 'El gateway configurado no responde', primaryErr);
  }
}
