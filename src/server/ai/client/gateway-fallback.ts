/**
 * Conmutación de gateway ante caída del primario.
 *
 * Cada ruta de modelo tiene su proveedor y los respaldos se resuelven por la
 * capa superior. Esta utilidad normaliza los fallos de red/servidor del gateway
 * actual como `gateway_down`, sin depender de variables globales.
 */
import type OpenAI from 'openai';
import { getGatewayClient } from './gateway-client';
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
export async function withGatewayFallback<T>(call: GatewayCall<T>): Promise<T> {
  try {
    return await call.run(getGatewayClient({ baseURL: call.baseURL, apiKey: call.apiKey }));
  } catch (primaryErr) {
    if (!isServerOrNetworkError(primaryErr)) {
      throw primaryErr;
    }
    throw aiError('gateway_down', 'El gateway configurado no responde', primaryErr);
  }
}
