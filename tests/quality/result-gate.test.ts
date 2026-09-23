/**
 * Evaluación POSTERIOR a la entrega: puntúa lo ya generado y cobrado.
 *
 * Reglas comprobadas: la evaluación se registra con `refId` = id del entregable;
 * si Jev falla, la entrega queda intacta (no se propaga el error); una memoria a
 * la que le faltan secciones se lo dice a Jev y puntúa bajo; y un plano ya
 * evaluado al leerlo no se vuelve a pagar.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import type { Deliverable } from '@/lib/contracts';
import { evaluateDeliverableResults } from '@/server/quality/result-gate';
import {
  buildMemoriaResultEvidence,
  buildPlanResultEvidence,
} from '@/server/quality/evidence/result-evidence';
import { QUALITY_THRESHOLDS_KEY } from '@/server/quality/evaluate';
import { prisma } from '@/server/db/prisma';
import { sealSecret } from '@/server/security/secret-box';
import { resetDb } from '../helpers/db';

const CTX = { organizationId: 'org-result', userId: 'user-result' };
const PROJECT = 'proyecto-1';

const MEMORIA_COMPLETA = [
  '# Memoria de materiales',
  '## Suelo: tarima de roble claro.',
  '## Paredes y techo: pintura mate blanca.',
  '## Iluminación: luminarias empotradas.',
  '## Textiles: cortinas de lino.',
  '## Paleta de color: neutros cálidos.',
].join('\n');

function memoriaDeliverable(markdown: string): Deliverable {
  return {
    id: 'del-memoria',
    type: 'memoria',
    legalSeal: 'sello',
    version: 1,
    payload: { type: 'memoria', markdown },
  };
}

function renderDeliverable(): Deliverable {
  return {
    id: 'del-render',
    type: 'render3d',
    legalSeal: 'sello',
    version: 1,
    payload: { type: 'render3d', assetUrl: 'https://example.test/r.png' },
  };
}

function jevMemoriaResponse(score: number, noul: number): Response {
  return new Response(
    JSON.stringify({
      model: 'jev-latest',
      answers: {
        completeness: { type: 'score', score, confidence: 0.8 },
        coherent: { type: 'noul', noul },
        length_ok: { type: 'noul', noul },
        actionable: { type: 'noul', noul },
      },
      usage: { input_tokens: 1200 },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

const fetchMock = vi.fn();

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

describe('evidencia del resultado', () => {
  it('detecta las secciones que faltan en la memoria', () => {
    const evidence = buildMemoriaResultEvidence('## Suelo: tarima.', { estilo: 'nórdico', objetivo: '' });
    expect(evidence.missingSections).toEqual(['paredes', 'iluminacion', 'textiles', 'paleta']);
    expect(buildMemoriaResultEvidence(MEMORIA_COMPLETA, { estilo: '', objetivo: '' }).missingSections)
      .toEqual([]);
  });

  it('cuenta huecos sin muro en el plano entregado', () => {
    const evidence = buildPlanResultEvidence({
      schemaVersion: 1,
      zones: [
        {
          id: 'z1',
          name: 'Salón',
          outline: [
            { x: 0, y: 0 },
            { x: 1000, y: 0 },
            { x: 1000, y: 1000 },
          ],
          walls: [{ id: 'w1', from: { x: 0, y: 0 }, to: { x: 1000, y: 0 }, thicknessMm: 100 }],
          apertures: [{ id: 'a1', kind: 'puerta', wallId: 'fantasma', position: 0.5, widthMm: 800 }],
          dimensions: [],
        },
      ],
    });
    expect(evidence.huecosSinMuro).toBe(1);
    expect(evidence.muros).toBe(1);
  });
});

describe('evaluateDeliverableResults', () => {
  it('registra la evaluación de la memoria con el id del entregable', async () => {
    await withKey();
    fetchMock.mockImplementation(async () => jevMemoriaResponse(4, 0.95));

    const recorded = await evaluateDeliverableResults(CTX, {
      projectId: PROJECT,
      deliverables: [memoriaDeliverable(MEMORIA_COMPLETA)],
      memoriaContext: { estilo: 'nórdico', objetivo: 'más luz' },
    });

    expect(recorded).toBe(1);
    const row = await prisma.aiQualityEvaluation.findFirstOrThrow();
    expect(row.checkpoint).toBe('memoria_result');
    expect(row.refId).toBe('del-memoria');
    expect(row.projectId).toBe(PROJECT);
    expect(row.decision).toBe('proceed');
  });

  it('una memoria con secciones ausentes puntúa bajo y se marca', async () => {
    await withKey();
    fetchMock.mockImplementation(async () => jevMemoriaResponse(1, 0.1));

    await evaluateDeliverableResults(CTX, {
      projectId: PROJECT,
      deliverables: [memoriaDeliverable('## Suelo: tarima.')],
      memoriaContext: { estilo: 'nórdico', objetivo: '' },
    });

    const row = await prisma.aiQualityEvaluation.findFirstOrThrow();
    expect(row.score).toBeLessThan(60);
    expect(row.decision).toBe('block');
    // La evidencia enviada nombra explícitamente lo que falta.
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? '{}')) as { state?: string };
    expect(body.state).toContain('missingSections');
    expect(body.state).toContain('textiles');
  });

  it('si Jev falla, la entrega queda intacta y el fallo se registra en cerrado', async () => {
    await withKey();
    fetchMock.mockImplementation(async () => new Response('boom', { status: 500 }));

    await expect(
      evaluateDeliverableResults(CTX, {
        projectId: PROJECT,
        deliverables: [memoriaDeliverable(MEMORIA_COMPLETA)],
      }),
    ).resolves.toBe(1);

    const row = await prisma.aiQualityEvaluation.findFirstOrThrow();
    expect(row.failOpen).toBe(false);
    expect(row.score).toBeNull();
  });

  it('un render sin auditoría de visión no se puntúa (Jev no ve imágenes)', async () => {
    await withKey();
    const recorded = await evaluateDeliverableResults(CTX, {
      projectId: PROJECT,
      deliverables: [renderDeliverable()],
    });
    expect(recorded).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('puntúa el veredicto textual del auditor cuando lo hay', async () => {
    await withKey();
    fetchMock.mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            model: 'jev-latest',
            answers: {
              fidelity: { type: 'score', score: 5 },
              accepted: { type: 'noul', noul: 0.99 },
              clean: { type: 'noul', noul: 0.99 },
              main_issue: { type: 'choice', choice: 'none' },
            },
            usage: { input_tokens: 300 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    );

    await evaluateDeliverableResults(CTX, {
      projectId: PROJECT,
      deliverables: [renderDeliverable()],
      audits: new Map([['del-render', { accepted: true, violations: [] }]]),
    });

    const row = await prisma.aiQualityEvaluation.findFirstOrThrow();
    expect(row.checkpoint).toBe('render_result');
    expect(row.refId).toBe('del-render');
  });

  it('un plano ya evaluado al leerlo reaprovecha su veredicto sin llamar a Jev', async () => {
    await withKey();
    await evaluateDeliverableResults(CTX, {
      projectId: PROJECT,
      deliverables: [
        {
          id: 'del-plano',
          type: 'plano2d',
          legalSeal: 'sello',
          version: 1,
          payload: {
            type: 'plano2d',
            plano: {
              schemaVersion: 1,
              zones: [],
              calidad: { score: 88, decision: 'proceed', motivos: [] },
            },
          },
        },
      ],
    });

    expect(fetchMock).not.toHaveBeenCalled();
    const row = await prisma.aiQualityEvaluation.findFirstOrThrow();
    expect(row.checkpoint).toBe('plan_result');
    expect(row.score).toBe(88);
    expect(Number(row.costUsd)).toBe(0);
  });
});
