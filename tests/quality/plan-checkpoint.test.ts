/**
 * Puerta de fiabilidad del plano: las respuestas de Jev al punto de control
 * `plan_extraction` deben caer en la banda correcta (seguir / confirmar /
 * bloquear) y, si Jev no contesta, fallar en cerrado. Jev se simula a nivel de
 * `fetch`: la evidencia y los pesos son los reales.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
// `evaluate` y el resolutor de claves importan 'server-only'; en Vitest no hay Server Components.
vi.mock('server-only', () => ({}));
import { evaluateCheckpoint, QUALITY_THRESHOLDS_KEY } from '@/server/quality/evaluate';
import { PLAN_EXTRACTION } from '@/server/quality/checkpoints';
import type { PlanEvidence } from '@/server/quality/evidence/plan-evidence';
import { prisma } from '@/server/db/prisma';
import { sealSecret } from '@/server/security/secret-box';
import { resetDb } from '../helpers/db';

const CTX = { organizationId: 'org-quality-plan', userId: 'user-quality-plan' };

const EVIDENCE: PlanEvidence = {
  murosRaster: 18,
  murosModelo: 16,
  murosPlano: 20,
  estanciasLeidas: 5,
  zonas: 5,
  zonasDibujables: 5,
  planoDibujable: true,
  escalaEstimada: false,
  cotasEscritas: 4,
  ajustesAplicados: 4,
  desviacionCotasPct: { max: 1.2, media: 0.4 },
  avisosPorTipo: {},
  huecosSinMuro: 0,
  murosDegenerados: 0,
};

/** Respuestas de Jev (score en base 0, como su leyenda «0»–«4»). */
function jevResponse(
  fidelity: number,
  noul: number | { rooms: number; structure: number; dims: number },
  choice: string,
): Response {
  const n = typeof noul === 'number' ? { rooms: noul, structure: noul, dims: noul } : noul;
  return new Response(
    JSON.stringify({
      model: 'jev-latest',
      answers: {
        fidelity: { type: 'score', score: fidelity, confidence: 0.8 },
        rooms_closed: { type: 'noul', noul: n.rooms },
        structure_sound: { type: 'noul', noul: n.structure },
        dimensions_match: { type: 'noul', noul: n.dims },
        main_issue: { type: 'choice', choice },
      },
      usage: { input_tokens: 1200 },
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

async function withKey() {
  await prisma.aiProviderCredential.create({
    data: {
      provider: 'typesafe',
      encryptedApiKey: sealSecret('sk-test-jev-123456'),
      keyHint: 'sk-…3456',
      enabled: true,
    },
  });
}

describe('punto de control plan_extraction', () => {
  it('pregunta en inglés, de forma atómica, y manda solo la evidencia medible', () => {
    const questions = Object.values(PLAN_EXTRACTION.questions).map((q) => q.build(EVIDENCE));
    expect(questions).toHaveLength(5);
    for (const question of questions) {
      expect(question.instructions).toMatch(/^[\x20-\x7E]+$/);
    }
    const state = PLAN_EXTRACTION.buildState(EVIDENCE);
    expect(state).not.toMatch(/base64|data:image/i);
    expect(JSON.parse(state).evidence).toEqual(EVIDENCE);
  });

  it('sin cotas escritas no pregunta por ellas ni penaliza la escala estimada', async () => {
    await withKey();
    fetchMock.mockResolvedValue(jevResponse(3, { rooms: 0.9, structure: 0.9, dims: 0 }, 'none'));
    const sinCotas = { ...EVIDENCE, cotasEscritas: 0, escalaEstimada: true, desviacionCotasPct: null };
    const result = await evaluateCheckpoint(CTX, PLAN_EXTRACTION.id, sinCotas);
    const sent = JSON.parse(String(fetchMock.mock.calls[0]![1]!.body)) as { questions: Record<string, unknown>; state: string };
    expect(Object.keys(sent.questions)).not.toContain('dimensions_match');
    expect(sent.state).toContain('no written dimensions');
    expect(result.reasons).not.toContain('Las medidas calculadas no cuadran con las cotas escritas en el plano.');
    expect(result.decision).toBe('proceed');
  });

  it('una lectura limpia sigue sola (banda alta)', async () => {
    await withKey();
    fetchMock.mockResolvedValue(jevResponse(4, 0.95, 'none'));

    const result = await evaluateCheckpoint(CTX, PLAN_EXTRACTION.id, EVIDENCE, { projectId: 'p-1' });
    expect(result.score).toBeGreaterThanOrEqual(85);
    expect(result.decision).toBe('proceed');
    expect(result.reasons).toEqual([]);
    expect(result.failOpen).toBe(true);
  });

  it('una lectura dudosa pide confirmación con motivos en español', async () => {
    await withKey();
    fetchMock.mockResolvedValue(jevResponse(3, { rooms: 0.9, structure: 0.9, dims: 0.4 }, 'scale'));

    const result = await evaluateCheckpoint(CTX, PLAN_EXTRACTION.id, EVIDENCE);
    expect(result.decision).toBe('confirm');
    expect(result.reasons).toContain('Las medidas calculadas no cuadran con las cotas escritas en el plano.');
  });

  it('una lectura rota bloquea y queda registrada', async () => {
    await withKey();
    fetchMock.mockResolvedValue(jevResponse(1, 0.2, 'walls'));

    const result = await evaluateCheckpoint(CTX, PLAN_EXTRACTION.id, EVIDENCE, { refId: 'asset-1' });
    expect(result.decision).toBe('block');
    expect(result.reasons.length).toBeGreaterThan(2);

    const row = await prisma.aiQualityEvaluation.findFirstOrThrow();
    expect(row.checkpoint).toBe('plan_extraction');
    expect(row.decision).toBe('block');
    expect(row.refId).toBe('asset-1');
  });

  it('si Jev se cae no se procede: confirmación expresa y failOpen=false', async () => {
    await withKey();
    fetchMock.mockResolvedValue(new Response('boom', { status: 500 }));

    const result = await evaluateCheckpoint(CTX, PLAN_EXTRACTION.id, EVIDENCE);
    expect(result.decision).toBe('confirm');
    expect(result.score).toBeNull();
    expect(result.failOpen).toBe(false);

    const row = await prisma.aiQualityEvaluation.findFirstOrThrow();
    expect(row.failOpen).toBe(false);
    expect(row.errorCode).not.toBeNull();
  });
});
