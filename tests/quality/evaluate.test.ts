import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
// `evaluate` y el resolutor de claves importan 'server-only'; en Vitest no hay Server Components.
vi.mock('server-only', () => ({}));
import { evaluateCheckpoint, QUALITY_THRESHOLDS_KEY } from '@/server/quality/evaluate';
import { PETICION_MINIMA, type PeticionEvidence } from '@/server/quality/checkpoints';
import { combineAnswers, decide, DEFAULT_THRESHOLDS, parseThresholds } from '@/server/quality/scoring';
import type { JevQuestion } from '@/server/quality/jev-client';
import { prisma } from '@/server/db/prisma';
import { sealSecret } from '@/server/security/secret-box';
import { resetDb } from '../helpers/db';

const CTX = { organizationId: 'org-quality', userId: 'user-quality', role: 'owner' as const };

const EVIDENCE: PeticionEvidence = { descripcion: 'Reforma de cocina', superficieM2: 60, estancias: 4 };

const QUESTIONS = Object.fromEntries(
  Object.entries(PETICION_MINIMA.questions).map(([id, spec]) => [id, spec.build(EVIDENCE)]),
) as Record<string, JevQuestion>;

function jevResponse(score: number, noul: number): Response {
  return new Response(
    JSON.stringify({
      model: 'jev-latest',
      answers: {
        completeness: { type: 'score', score, confidence: 0.8 },
        consistency: { type: 'noul', noul },
      },
      usage: { input_tokens: 2000 },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

const fetchMock = vi.fn();

beforeEach(async () => {
  await resetDb();
  await prisma.aiQualityEvaluation.deleteMany();
  await prisma.aiProviderCredential.deleteMany({ where: { provider: 'typesafe' } });
  await prisma.systemSetting.deleteMany({ where: { key: QUALITY_THRESHOLDS_KEY } });
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('scoring (núcleo puro)', () => {
  it('combina las respuestas con los pesos del punto de control', () => {
    // completeness=4/4 (peso 2) y consistency=0,4 (peso 1) → (2·1 + 1·0,4)/3 = 80
    const combined = combineAnswers(PETICION_MINIMA, QUESTIONS, {
      completeness: { type: 'score', score: 4, confidence: 0.9 },
      consistency: { type: 'noul', noul: 0.4 },
    });
    expect(combined.score).toBe(80);
    expect(combined.reasons).toEqual(['Los datos de la petición se contradicen entre sí.']);
  });

  it('ignora las preguntas sin respuesta utilizable en lugar de hundir el score', () => {
    const combined = combineAnswers(PETICION_MINIMA, QUESTIONS, {
      completeness: { type: 'score', score: 4 },
    });
    expect(combined.score).toBe(100);
  });

  it('devuelve score nulo si ninguna respuesta sirve', () => {
    expect(combineAnswers(PETICION_MINIMA, QUESTIONS, {}).score).toBeNull();
  });

  it('aplica las bandas por defecto', () => {
    expect(decide(85, DEFAULT_THRESHOLDS)).toBe('proceed');
    expect(decide(84, DEFAULT_THRESHOLDS)).toBe('confirm');
    expect(decide(60, DEFAULT_THRESHOLDS)).toBe('confirm');
    expect(decide(59, DEFAULT_THRESHOLDS)).toBe('block');
  });

  it('cae a los umbrales de serie si el ajuste es incoherente', () => {
    expect(parseThresholds({ proceed: 50, confirm: 70 })).toEqual(DEFAULT_THRESHOLDS);
    expect(parseThresholds(null)).toEqual(DEFAULT_THRESHOLDS);
    expect(parseThresholds({ proceed: 90, confirm: 40 })).toEqual({ proceed: 90, confirm: 40 });
  });
});

describe('evaluateCheckpoint', () => {
  it('decide proceed con buena evidencia y registra la evaluación con su coste', async () => {
    await prisma.aiProviderCredential.create({
      data: { provider: 'typesafe', encryptedApiKey: sealed(), keyHint: 'sk-…3456', enabled: true },
    });
    fetchMock.mockResolvedValue(jevResponse(4, 0.95));

    const result = await evaluateCheckpoint(CTX, PETICION_MINIMA.id, EVIDENCE, { refId: 'plan-1' });
    expect(result.decision).toBe('proceed');
    expect(result.score).toBe(98);
    expect(result.failOpen).toBe(true);

    const row = await prisma.aiQualityEvaluation.findFirstOrThrow();
    expect(row.checkpoint).toBe(PETICION_MINIMA.id);
    expect(row.refId).toBe('plan-1');
    expect(row.decision).toBe('proceed');
    expect(row.jevModel).toBe('jev-latest');
    expect(row.inputTokens).toBe(2000);
    expect(Number(row.costUsd)).toBeCloseTo(0.000084, 8);
    expect(row.errorCode).toBeNull();
  });

  it('bloquea cuando la evidencia puntúa por debajo de la banda baja', async () => {
    await prisma.aiProviderCredential.create({
      data: { provider: 'typesafe', encryptedApiKey: sealed(), keyHint: 'sk-…3456', enabled: true },
    });
    fetchMock.mockResolvedValue(jevResponse(1, 0.1));

    const result = await evaluateCheckpoint(CTX, PETICION_MINIMA.id, EVIDENCE);
    expect(result.decision).toBe('block');
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('respeta los umbrales configurados en los ajustes de sistema', async () => {
    await prisma.aiProviderCredential.create({
      data: { provider: 'typesafe', encryptedApiKey: sealed(), keyHint: 'sk-…3456', enabled: true },
    });
    await prisma.systemSetting.create({
      data: { key: QUALITY_THRESHOLDS_KEY, value: { proceed: 99, confirm: 90 } },
    });
    fetchMock.mockResolvedValue(jevResponse(4, 0.5));

    const result = await evaluateCheckpoint(CTX, PETICION_MINIMA.id, EVIDENCE);
    expect(result.score).toBe(83);
    expect(result.decision).toBe('block');
  });

  it('sin clave configurada no procede: confirma, lo registra y marca failOpen=false', async () => {
    const result = await evaluateCheckpoint(CTX, PETICION_MINIMA.id, EVIDENCE, { projectId: 'p-1' });
    expect(result.decision).toBe('confirm');
    expect(result.score).toBeNull();
    expect(result.failOpen).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();

    const row = await prisma.aiQualityEvaluation.findFirstOrThrow();
    expect(row.failOpen).toBe(false);
    expect(row.errorCode).toBe('provider_down');
    expect(row.projectId).toBe('p-1');
    expect(Number(row.costUsd)).toBe(0);
  });

  it('falla en cerrado si Jev se cae', async () => {
    await prisma.aiProviderCredential.create({
      data: { provider: 'typesafe', encryptedApiKey: sealed(), keyHint: 'sk-…3456', enabled: true },
    });
    fetchMock.mockResolvedValue(new Response('boom', { status: 500 }));

    const result = await evaluateCheckpoint(CTX, PETICION_MINIMA.id, EVIDENCE);
    expect(result.decision).toBe('confirm');
    expect(result.failOpen).toBe(false);
  });

  it('rechaza un punto de control desconocido', async () => {
    await expect(evaluateCheckpoint(CTX, 'no_existe', EVIDENCE)).rejects.toThrow(/desconocido/);
  });
});

function sealed(): string {
  return sealSecret('sk-test-jev-123456');
}
