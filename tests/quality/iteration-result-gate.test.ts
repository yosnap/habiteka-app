/**
 * Evaluación posterior de las versiones creadas por ITERACIÓN.
 *
 * Reglas comprobadas: la versión nueva se puntúa con su propio id como
 * referencia, y si Jev falla la iteración sigue adelante sin romperse.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import type { DebitService, Hold, ImageAdapter, CanvasZone } from '@/lib/contracts';
import { runFeedback } from '@/server/agent/feedback/feedback-orchestrator';
import { DELIVERABLE_LEGAL_SEAL } from '@/server/agent/legal/seal';
import { prisma } from '@/server/db/prisma';
import { sealSecret } from '@/server/security/secret-box';
import { makeOrg, resetDb } from '../helpers/db';

const zone: CanvasZone = { id: 'global', bbox: { x: 0, y: 0, width: 1, height: 1 } };
const image: ImageAdapter = {
  generate: async () => ({ assetUrl: '', cost: { amountUsd: 0, unit: 'image' } }),
  inpaint: async () => ({ assetUrl: '', cost: { amountUsd: 0, unit: 'image' } }),
};
const debit: DebitService = {
  hold: async (key): Promise<Hold> => ({ idempotencyKey: key, amount: 1 }),
  settle: async () => undefined,
  revert: async () => undefined,
};

const MEMORIA = [
  '# Memoria',
  '## Suelo: tarima de roble.',
  '## Paredes y techo: pintura mate.',
  '## Iluminación: empotradas.',
  '## Textiles: lino.',
  '## Paleta de color: neutros.',
].join('\n');

const fetchMock = vi.fn();

function jevResponse(): Response {
  return new Response(
    JSON.stringify({
      model: 'jev-latest',
      answers: {
        completeness: { type: 'score', score: 4, confidence: 0.9 },
        coherent: { type: 'noul', noul: 0.95 },
        length_ok: { type: 'noul', noul: 0.9 },
        actionable: { type: 'noul', noul: 0.9 },
      },
      usage: { input_tokens: 900 },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

async function makeMemoria() {
  const organizationId = await makeOrg(1000);
  const project = await prisma.project.create({ data: { organizationId, title: 'P' } });
  const deliverable = await prisma.deliverable.create({
    data: {
      projectId: project.id, type: 'MEMORIA', version: 1, legalSeal: DELIVERABLE_LEGAL_SEAL,
      payload: { type: 'memoria', markdown: MEMORIA },
    },
  });
  return { organizationId, projectId: project.id, deliverableId: deliverable.id };
}

async function iterate(ids: { organizationId: string; projectId: string; deliverableId: string }) {
  return runFeedback(
    {
      image,
      debit,
      regenerateZone: async () => {
        throw new Error('no aplica');
      },
      reviseMemoria: async () => MEMORIA + '\nRevisada con más detalle de acabados.',
    },
    {
      organizationId: ids.organizationId,
      deliverableId: ids.deliverableId,
      zone,
      instruction: 'usa tonos más cálidos',
      estimateCredits: 10,
      attemptId: 'intento-1',
      quality: { userId: 'user-iter', projectId: ids.projectId },
    },
  );
}

describe('calidad de las versiones iteradas', () => {
  beforeEach(async () => {
    await resetDb();
    await prisma.aiQualityEvaluation.deleteMany();
    await prisma.aiProviderCredential.deleteMany({ where: { provider: 'typesafe' } });
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('registra la evaluación con el id de la versión nueva', async () => {
    await prisma.aiProviderCredential.create({
      data: {
        provider: 'typesafe', encryptedApiKey: sealSecret('sk-test-jev-123456'),
        keyHint: 'sk-…3456', enabled: true,
      },
    });
    fetchMock.mockImplementation(async () => jevResponse());
    const ids = await makeMemoria();

    const result = await iterate(ids);

    const rows = await prisma.aiQualityEvaluation.findMany({ where: { checkpoint: 'memoria_result' } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      refId: result.newDeliverableId,
      projectId: ids.projectId,
      failOpen: true,
    });
    expect(rows[0]?.score).toBeGreaterThan(0);
  });

  it('no rompe la iteración si Jev falla', async () => {
    // Sin credencial de Jev: la evaluación no puede hacerse.
    fetchMock.mockRejectedValue(new Error('red caída'));
    const ids = await makeMemoria();

    const result = await iterate(ids);

    expect(result.newDeliverableId).toBeTruthy();
    const version = await prisma.deliverable.findUnique({ where: { id: result.newDeliverableId } });
    expect(version?.version).toBe(2);
  });
});
