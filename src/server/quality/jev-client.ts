import 'server-only';

/**
 * Cliente de Jev (TypeSafe): juicios tipados, no prosa.
 *
 * Se le manda un `state` (texto o JSON serializado) y un mapa de preguntas
 * atómicas en inglés; devuelve valores tipados con su probabilidad. Todas las
 * preguntas de un punto de control viajan en UNA sola llamada: se evalúan en
 * paralelo y añadir preguntas apenas cuesta.
 *
 * Los fallos se normalizan a `AiError` para que quien llama decida (reintentar,
 * degradar o cortar) sin leer códigos HTTP. La clave nunca se registra.
 */
import { aiError, type AiError } from '@/server/ai/errors';
import { resolveProviderKey } from '@/server/ai/provider-key-resolver';

export const TYPESAFE_PROVIDER = 'typesafe';
export const JEV_DEFAULT_MODEL = 'jev-latest';
/** Tarifa pública de Jev: 0,042 $ por millón de tokens de entrada; salida gratis. */
export const JEV_INPUT_USD_PER_MTOK = 0.042;

const BASE_URL = 'https://api.typesafe.ai';
const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;
const RETRY_BASE_MS = 500;

export type JevChoiceQuestion = {
  type: 'choice';
  instructions: string;
  criteria: Record<string, string | null>;
};
export type JevScoreQuestion = { type: 'score'; instructions: string; criteria: string[] };
export type JevNoulQuestion = {
  type: 'noul';
  instructions: string;
  criteria?: { true?: string; false?: string };
};
export type JevQuestion = JevChoiceQuestion | JevScoreQuestion | JevNoulQuestion;

export interface JevAnswer {
  type?: 'choice' | 'score' | 'noul';
  choice?: string;
  score?: number;
  noul?: number;
  probabilities?: Record<string, number> | number[];
  confidence?: number;
  legend?: unknown;
}

export interface JevResult {
  model: string;
  answers: Record<string, JevAnswer>;
  inputTokens: number;
  costUsd: number;
}

export interface AskJevOptions {
  model?: string;
  timeoutMs?: number;
  /** Inyectable en pruebas; por defecto la clave cifrada del panel de admin. */
  apiKey?: string;
}

/** Manda estado + preguntas a Jev y devuelve respuestas tipadas con su coste. */
export async function askJev(
  state: string,
  questions: Record<string, JevQuestion>,
  options: AskJevOptions = {},
): Promise<JevResult> {
  assertQuestions(questions);
  const apiKey = options.apiKey ?? (await resolveProviderKey(TYPESAFE_PROVIDER));
  const model = options.model ?? JEV_DEFAULT_MODEL;
  const body = JSON.stringify({ state, model, questions });

  for (let attempt = 0; ; attempt += 1) {
    const response = await postOnce(apiKey, body, options.timeoutMs ?? TIMEOUT_MS);
    if (response.ok) return parseResult(await readJson(response), model);
    if (isRetryable(response.status) && attempt < MAX_RETRIES) {
      await sleep(RETRY_BASE_MS * 2 ** attempt);
      continue;
    }
    throw httpError(response.status, await response.text().catch(() => ''));
  }
}

async function postOnce(apiKey: string, body: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${BASE_URL}/v1/systemone`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body,
      signal: controller.signal,
    });
  } catch (cause) {
    if (isAbort(cause)) throw aiError('timeout', 'Jev no respondió a tiempo', cause);
    throw aiError('provider_down', 'No se pudo contactar con Jev (TypeSafe)', cause);
  } finally {
    clearTimeout(timer);
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch (cause) {
    throw aiError('schema', 'Jev devolvió una respuesta ilegible', cause);
  }
}

function parseResult(payload: unknown, fallbackModel: string): JevResult {
  const data = payload as { model?: string; answers?: unknown; usage?: { input_tokens?: number } };
  const answers = data?.answers;
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    throw aiError('schema', 'Jev devolvió una respuesta sin respuestas tipadas');
  }
  const inputTokens = Number(data.usage?.input_tokens ?? 0);
  const tokens = Number.isFinite(inputTokens) && inputTokens > 0 ? Math.round(inputTokens) : 0;
  return {
    model: data.model ?? fallbackModel,
    answers: answers as Record<string, JevAnswer>,
    inputTokens: tokens,
    costUsd: (tokens * JEV_INPUT_USD_PER_MTOK) / 1_000_000,
  };
}

function httpError(status: number, raw: string): AiError {
  const detail = raw.slice(0, 300);
  if (status === 429) return aiError('rate_limit', 'Jev ha superado su límite de peticiones', detail);
  if (status === 529) return aiError('provider_down', 'Jev está sobrecargado', detail);
  if (status === 401 || status === 403)
    return aiError('provider_down', 'La clave de Jev (TypeSafe) no es válida', detail);
  if (status === 422) return aiError('schema', 'Jev rechazó las preguntas enviadas', detail);
  return aiError('provider_down', `Jev respondió con un error (${status})`, detail);
}

function isRetryable(status: number): boolean {
  return status === 429 || status === 529;
}

function isAbort(cause: unknown): boolean {
  return (cause as { name?: string } | null)?.name === 'AbortError';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Valida las preguntas antes de gastar una llamada (mismo contrato que la API). */
function assertQuestions(questions: Record<string, JevQuestion>): void {
  const ids = Object.keys(questions ?? {});
  if (ids.length === 0) throw aiError('schema', 'Jev necesita al menos una pregunta');
  for (const id of ids) {
    const question = questions[id]!;
    if (!question?.instructions?.trim())
      throw aiError('schema', `La pregunta «${id}» no tiene instrucciones`);
    if (question.type === 'choice' && Object.keys(question.criteria ?? {}).length < 2)
      throw aiError('schema', `La pregunta «${id}» necesita al menos dos opciones`);
    if (question.type === 'score' && (question.criteria ?? []).length < 2)
      throw aiError('schema', `La pregunta «${id}» necesita al menos dos niveles`);
    if (!['choice', 'score', 'noul'].includes(question.type))
      throw aiError('schema', `La pregunta «${id}» tiene un tipo desconocido`);
  }
}
