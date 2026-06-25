/**
 * Construcción del cliente del gateway de IA (OpenAI SDK apuntando a OpenRouter).
 *
 * OpenRouter expone la Chat Completions API estándar, así que se usa el SDK
 * oficial de OpenAI con `baseURL` propio. La clave se lee solo del entorno
 * (server-only) y se falla rápido si falta. El SDK se inyecta a través de una
 * factory para que los tests sustituyan la red por un doble determinista.
 */
import OpenAI from 'openai';
import { aiError } from '../errors';

export interface GatewaySpec {
  /** baseURL del gateway; null ⇒ OpenRouter por defecto. */
  baseURL: string | null;
}

const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';

export type ClientFactory = (spec: GatewaySpec) => OpenAI;

// Factory por defecto: SDK real. Sustituible en tests vía `setClientFactory`.
let factory: ClientFactory = (spec) => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw aiError('gateway_down', 'OPENROUTER_API_KEY no está definida');
  }
  return new OpenAI({
    apiKey,
    baseURL: spec.baseURL ?? DEFAULT_BASE_URL,
    defaultHeaders: {
      'HTTP-Referer': process.env.BETTER_AUTH_URL ?? 'https://habiteka.app',
      'X-Title': 'Habiteka',
    },
  });
};

export function getGatewayClient(spec: GatewaySpec): OpenAI {
  return factory(spec);
}

/** Inyecta una factory de cliente (tests). Devuelve la previa para restaurarla. */
export function setClientFactory(next: ClientFactory): ClientFactory {
  const prev = factory;
  factory = next;
  return prev;
}
