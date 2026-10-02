/**
 * Lectura de plano compartida por el estudio y por el asistente: el veredicto de
 * Jev viaja hasta quien la llama y queda guardado en el estudio, para que aplicar
 * al editor lea la decisión del SERVIDOR y no la que diga el navegador.
 *
 * La extracción (visión + ráster) y el almacenamiento se simulan; la evidencia,
 * los pesos y las bandas son los reales, y Jev se simula a nivel de `fetch`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
vi.mock('server-only', () => ({}));

// Geometría sin solapes ni ajustes: estas pruebas aíslan el veredicto de Jev.
// Los riesgos del plano CAD real se comprueban en plan-import-risks.test.ts.
const source = {
  raw: {
    anchoMetros: 6, altoMetros: 4, escalaFiable: true,
    muros: [
      { x1: 0.1, y1: 0.1, x2: 0.7, y2: 0.1 },
      { x1: 0.7, y1: 0.1, x2: 0.7, y2: 0.5 },
      { x1: 0.7, y1: 0.5, x2: 0.1, y2: 0.5 },
      { x1: 0.1, y1: 0.5, x2: 0.1, y2: 0.1 },
    ],
    aberturas: [],
    habitaciones: [{ nombre: 'Salón', poligono: [
      { x: 0.1, y: 0.1 }, { x: 0.7, y: 0.1 }, { x: 0.7, y: 0.5 }, { x: 0.1, y: 0.5 },
    ] }],
  },
  detected: null,
};
const saved: Array<Record<string, unknown>> = [];

vi.mock('@/server/plan/studio-image', () => ({
  readStudioImage: async () => ({ base64: 'AAAA', mimeType: 'image/png' }),
  persistStudioSource: async () => ({ assetUrl: 'https://cdn/plan.png', assetKey: 'plan.png' }),
}));
vi.mock('@/server/ai', () => ({
  getChatVisionAdapter: async () => ({ chat: async () => ({ content: '' }), chatStream: async function* () {} }),
}));
vi.mock('@/server/plan/extract-plan-source', () => ({
  extractPlanSource: async () => source,
}));
vi.mock('@/server/plan/studio-repo', () => ({
  saveStudio: async (_ctx: unknown, _projectId: string, state: Record<string, unknown>) => {
    saved.push(state);
  },
}));

import { importPlanFromImage } from '@/server/plan/import-plan-from-image';
import { QUALITY_THRESHOLDS_KEY } from '@/server/quality/evaluate';
import { prisma } from '@/server/db/prisma';
import { sealSecret } from '@/server/security/secret-box';
import { resetDb } from '../helpers/db';
import type { OrgContext } from '@/server/auth/org-context';
import type { StudioQuality } from '@/lib/studio-state';

const CTX = { organizationId: 'org-plan-import', userId: 'user-plan-import' } as OrgContext;
const IMAGE = { assetUrl: 'https://cdn/plan.png', assetKey: 'plan.png' };

/** Respuestas de Jev a las cinco preguntas del punto de control del plano. */
function jevResponse(fidelity: number, noul: number, choice: string): Response {
  return new Response(
    JSON.stringify({
      model: 'jev-latest',
      answers: {
        fidelity: { type: 'score', score: fidelity, confidence: 0.8 },
        rooms_closed: { type: 'noul', noul },
        dimensions_match: { type: 'noul', noul },
        wall_counts: { type: 'noul', noul },
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
  saved.length = 0;
  await prisma.aiQualityEvaluation.deleteMany();
  await prisma.aiProviderCredential.deleteMany({ where: { provider: 'typesafe' } });
  await prisma.systemSetting.deleteMany({ where: { key: QUALITY_THRESHOLDS_KEY } });
  await prisma.aiProviderCredential.create({
    data: {
      provider: 'typesafe',
      encryptedApiKey: sealSecret('sk-test-jev-123456'),
      keyHint: 'sk-…3456',
      enabled: true,
    },
  });
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function importOnce(): Promise<StudioQuality> {
  const result = await importPlanFromImage(CTX, 'p-assistant', IMAGE, { includeFurniture: false }, {});
  return result.quality;
}

describe('importPlanFromImage — puerta de fiabilidad', () => {
  it('una lectura limpia sigue sola y guarda el plano con su veredicto', async () => {
    fetchMock.mockResolvedValue(jevResponse(5, 0.95, 'none'));

    const quality = await importOnce();
    expect(quality.decision).toBe('proceed');
    expect(quality.failOpen).toBe(true);
    expect(quality.score).toBeGreaterThanOrEqual(85);

    const state = saved.at(-1)!;
    expect(state.quality).toMatchObject({ decision: 'proceed' });
    expect(state.plano).toBeTruthy();
    // La extracción cruda queda guardada para recalcular medidas sin volver a la IA.
    expect(state.planImport).toBeTruthy();
  });

  it('una lectura dudosa pide confirmación con motivos en español', async () => {
    fetchMock.mockResolvedValue(jevResponse(4, 0.6, 'scale'));

    const quality = await importOnce();
    expect(quality.decision).toBe('confirm');
    expect(quality.reasons.length).toBeGreaterThan(0);
    expect(quality.failOpen).toBe(true);
  });

  it('una lectura rota bloquea: nada de pago se genera con ese plano', async () => {
    fetchMock.mockResolvedValue(jevResponse(2, 0.2, 'walls'));

    const quality = await importOnce();
    expect(quality.decision).toBe('block');
    expect(saved.at(-1)!.quality).toMatchObject({ decision: 'block' });
  });

  it('si Jev falla no se procede: confirmación expresa y failOpen=false', async () => {
    fetchMock.mockResolvedValue(new Response('boom', { status: 500 }));

    const quality = await importOnce();
    expect(quality.decision).toBe('confirm');
    expect(quality.score).toBeNull();
    expect(quality.failOpen).toBe(false);

    const row = await prisma.aiQualityEvaluation.findFirstOrThrow();
    expect(row.checkpoint).toBe('plan_extraction');
    expect(row.projectId).toBe('p-assistant');
    expect(row.failOpen).toBe(false);
  });
});
