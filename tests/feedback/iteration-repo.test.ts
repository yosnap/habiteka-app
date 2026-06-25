import { describe, it, expect, beforeEach } from 'vitest';
import { runFeedback } from '@/server/agent/feedback/feedback-orchestrator';
import { listIterations } from '@/server/agent/feedback/iteration-repo';
import { DELIVERABLE_LEGAL_SEAL } from '@/server/agent/legal/seal';
import { prisma } from '@/server/db/prisma';
import { resetDb, makeOrg } from '../helpers/db';
import type { ImageAdapter, DebitService, Hold, CanvasZone } from '@/lib/contracts';

const okImage: ImageAdapter = {
  generate: async () => ({ assetUrl: '', cost: { amountUsd: 0, unit: 'image' } }),
  inpaint: async () => ({
    assetUrl: 'https://cdn/iterated.png',
    cost: { amountUsd: 0.04, unit: 'image' },
  }),
};
const failImage: ImageAdapter = {
  generate: async () => ({ assetUrl: '', cost: { amountUsd: 0, unit: 'image' } }),
  inpaint: async () => {
    throw new Error('proveedor caído');
  },
};

function trackedDebit(calls: string[]): DebitService {
  return {
    hold: async (k): Promise<Hold> => {
      calls.push('hold');
      return { idempotencyKey: k, amount: 1 };
    },
    settle: async () => {
      calls.push('settle');
    },
    revert: async () => {
      calls.push('revert');
    },
  };
}

const zone: CanvasZone = { id: 'z1', bbox: { x: 0.1, y: 0.1, width: 0.3, height: 0.3 } };

async function makeRender(): Promise<{ orgId: string; deliverableId: string; projectId: string }> {
  const orgId = await makeOrg(1000);
  const project = await prisma.project.create({ data: { organizationId: orgId, title: 'P' } });
  const del = await prisma.deliverable.create({
    data: {
      projectId: project.id,
      type: 'RENDER_3D',
      payload: { type: 'render3d', assetUrl: 'https://cdn/base.png' },
      legalSeal: DELIVERABLE_LEGAL_SEAL,
      version: 1,
    },
  });
  return { orgId, deliverableId: del.id, projectId: project.id };
}

describe('runFeedback — versionado, inmutabilidad y cobro', () => {
  beforeEach(resetDb);

  it('crea una nueva versión sin alterar la previa, con sello, y cobra (hold→settle)', async () => {
    const { orgId, deliverableId, projectId } = await makeRender();
    const calls: string[] = [];

    const result = await runFeedback(
      {
        image: okImage,
        debit: trackedDebit(calls),
        regenerateZone: async () => ({
          id: 'z',
          name: '',
          outline: [],
          walls: [],
          apertures: [],
          dimensions: [],
        }),
      },
      { organizationId: orgId, deliverableId, zone, instruction: 'más luz', estimateCredits: 500 },
    );

    expect(result.version).toBe(2);
    expect(calls).toEqual(['hold', 'settle']);

    // La versión previa sigue intacta y existe la nueva: dos filas.
    const versions = await prisma.deliverable.findMany({
      where: { projectId },
      orderBy: { version: 'asc' },
    });
    expect(versions).toHaveLength(2);
    expect(versions[0]?.version).toBe(1);
    expect((versions[0]?.payload as { assetUrl: string }).assetUrl).toBe('https://cdn/base.png');
    expect(versions[1]?.legalSeal).toBe(DELIVERABLE_LEGAL_SEAL);

    // Se registró la fila de iteración apuntando a la nueva versión.
    const history = await listIterations(orgId, deliverableId);
    expect(history).toHaveLength(1);
    expect(history[0]?.resultRef).toBe(result.newDeliverableId);
  });

  it('si el inpaint falla, revierte el cobro y no crea versión', async () => {
    const { orgId, deliverableId, projectId } = await makeRender();
    const calls: string[] = [];

    await expect(
      runFeedback(
        {
          image: failImage,
          debit: trackedDebit(calls),
          regenerateZone: async () => ({
            id: 'z',
            name: '',
            outline: [],
            walls: [],
            apertures: [],
            dimensions: [],
          }),
        },
        { organizationId: orgId, deliverableId, zone, instruction: 'x', estimateCredits: 500 },
      ),
    ).rejects.toBeTruthy();

    expect(calls).toContain('revert');
    expect(calls).not.toContain('settle');
    const versions = await prisma.deliverable.count({ where: { projectId } });
    expect(versions).toBe(1); // no se creó una nueva versión
  });

  it('no itera sobre un entregable de otra organización (anti-IDOR)', async () => {
    const { deliverableId } = await makeRender();
    const otherOrg = await makeOrg(1000);
    const calls: string[] = [];

    await expect(
      runFeedback(
        {
          image: okImage,
          debit: trackedDebit(calls),
          regenerateZone: async () => ({
            id: 'z',
            name: '',
            outline: [],
            walls: [],
            apertures: [],
            dimensions: [],
          }),
        },
        { organizationId: otherOrg, deliverableId, zone, instruction: 'x', estimateCredits: 500 },
      ),
    ).rejects.toBeTruthy();
  });
});
