import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
// El cliente importa 'server-only' (resuelve la clave cifrada); en Vitest no hay Server Components.
vi.mock('server-only', () => ({}));
import { askJev, JEV_INPUT_USD_PER_MTOK, type JevQuestion } from '@/server/quality/jev-client';
import { AiError } from '@/server/ai/errors';

const QUESTIONS: Record<string, JevQuestion> = {
  completeness: {
    type: 'score',
    instructions: 'How complete is this request?',
    criteria: ['Unusable', 'Poor', 'Acceptable', 'Complete'],
  },
};

const OK_BODY = {
  model: 'jev-latest',
  answers: { completeness: { type: 'score', score: 4, confidence: 0.9 } },
  usage: { input_tokens: 1000, output_tokens: 0 },
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('askJev', () => {
  it('devuelve las respuestas tipadas y calcula el coste desde los tokens de entrada', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, OK_BODY));
    const result = await askJev('{"a":1}', QUESTIONS, { apiKey: 'sk-test-123456' });
    expect(result.model).toBe('jev-latest');
    expect(result.answers.completeness?.score).toBe(4);
    expect(result.inputTokens).toBe(1000);
    expect(result.costUsd).toBeCloseTo((1000 * JEV_INPUT_USD_PER_MTOK) / 1_000_000, 12);
  });

  it('manda la clave como Bearer sin exponerla en el cuerpo', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, OK_BODY));
    await askJev('estado', QUESTIONS, { apiKey: 'sk-secreta-123456' });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.typesafe.ai/v1/systemone');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-secreta-123456');
    expect(init.body).not.toContain('sk-secreta');
    expect(JSON.parse(init.body as string).model).toBe('jev-latest');
  });

  it('normaliza un 422 como error de esquema y no reintenta', async () => {
    fetchMock.mockResolvedValue(jsonResponse(422, { error: 'bad questions' }));
    await expect(askJev('estado', QUESTIONS, { apiKey: 'sk-test-123456' })).rejects.toMatchObject({
      kind: 'schema',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reintenta un 429 y devuelve el resultado del siguiente intento', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(429, { error: 'rate' }))
      .mockResolvedValueOnce(jsonResponse(200, OK_BODY));
    const result = await askJev('estado', QUESTIONS, { apiKey: 'sk-test-123456' });
    expect(result.answers.completeness?.score).toBe(4);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('agota los reintentos con 529 y devuelve provider_down', async () => {
    fetchMock.mockResolvedValue(jsonResponse(529, { error: 'overloaded' }));
    await expect(askJev('estado', QUESTIONS, { apiKey: 'sk-test-123456' })).rejects.toMatchObject({
      kind: 'provider_down',
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('traduce el abort del timeout a un AiError de timeout', async () => {
    fetchMock.mockImplementation(() => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      return Promise.reject(error);
    });
    const error = await askJev('estado', QUESTIONS, { apiKey: 'sk-test-123456', timeoutMs: 5 }).catch(
      (cause) => cause,
    );
    expect(error).toBeInstanceOf(AiError);
    expect((error as AiError).kind).toBe('timeout');
  });

  it('rechaza preguntas mal formadas antes de gastar una llamada', async () => {
    await expect(
      askJev('estado', { vacia: { type: 'score', instructions: 'x', criteria: ['solo uno'] } }, {
        apiKey: 'sk-test-123456',
      }),
    ).rejects.toMatchObject({ kind: 'schema' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
