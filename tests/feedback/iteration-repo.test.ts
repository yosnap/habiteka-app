import { describe, it, expect, beforeEach, vi } from 'vitest';
// La iteración puntúa la versión nueva, y esa capa es solo de servidor.
vi.mock('server-only', () => ({}));
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

describe('runFeedback — cambios por texto desde «Diseños»', () => {
  beforeEach(resetDb);
  const noZone = async () => { throw new Error('no se usa'); };

  it('rechaza zonas inválidas antes de reservar créditos o llamar a imagen', async () => {
    const { orgId, deliverableId } = await makeRender();
    const calls: string[] = [];
    const inpaint = vi.fn();
    await expect(runFeedback({ image: { ...okImage, inpaint }, debit: trackedDebit(calls), regenerateZone: noZone }, {
      organizationId: orgId, deliverableId, instruction: 'Retoca la puerta', estimateCredits: 500,
      zone: { id: 'bad', bbox: { x: Infinity, y: 0, width: .2, height: .2 } },
    })).rejects.toThrow('coordenadas');
    expect(calls).toEqual([]);
    expect(inpaint).not.toHaveBeenCalled();
  });

  it('conserva el polígono y los metadatos de protección sin heredar aceptación ni auditoría', async () => {
    const { orgId, deliverableId } = await makeRender();
    await prisma.deliverable.update({ where: { id: deliverableId }, data: { payload: {
      type: 'render3d', assetUrl: 'old', generation: { documentRevision: 16, promptVersion: 'old', model: 'old-model',
        acceptance: { acceptedAt: 'yesterday', userId: 'u' }, fidelity: { status: 'passed' } },
    } } });
    const polygon: CanvasZone = { id: 'triangle', polygon: [{ x: .1, y: .1 }, { x: .6, y: .1 }, { x: .1, y: .6 }] };
    const inpaint = vi.fn(async () => ({ assetUrl: 'protected', cost: { amountUsd: .15, unit: 'image' as const },
      regionEdit: { mode: 'original-pixels-v1' as const, zone: polygon, protectedPixels: 88, totalPixels: 100,
        contextCrop: { x: 120, y: 80, width: 512, height: 512 } },
      generation: { provider: 'test', model: 'edited-model', fallbackIndex: 0 } }));
    const out = await runFeedback({ image: { ...okImage, inpaint }, debit: trackedDebit([]), regenerateZone: noZone }, {
      organizationId: orgId, deliverableId, instruction: 'Retoca la puerta', estimateCredits: 500, zone: polygon,
    });
    expect(inpaint).toHaveBeenCalledWith(expect.objectContaining({ zone: polygon }));
    const row = await prisma.deliverable.findUniqueOrThrow({ where: { id: out.newDeliverableId } });
    expect(row.payload).toMatchObject({ imageEdit: { sourceDeliverableId: deliverableId, zone: polygon, protectedPixels: 88,
      contextCrop: { x: 120, y: 80, width: 512, height: 512 } },
      generation: { model: 'edited-model', promptVersion: 'habiteka-directed-inpaint-v4', documentRevision: 16 } });
    expect((row.payload as { generation: object }).generation).not.toHaveProperty('acceptance');
    expect((row.payload as { generation: object }).generation).not.toHaveProperty('fidelity');
  });

  it('el render se retoca sobre la imagen base aportada y la versión hereda zona y origen', async () => {
    const { orgId, deliverableId, projectId } = await makeRender();
    const zoneRow = await prisma.projectZone.create({ data: { organizationId: orgId, projectId, name: 'Salón' } });
    await prisma.deliverable.update({ where: { id: deliverableId }, data: { zoneId: zoneRow.id } });
    let base: unknown;
    const image: ImageAdapter = {
      ...okImage,
      inpaint: async (req) => {
        base = req.baseImage;
        return { assetUrl: 'https://cdn/iterated.png', cost: { amountUsd: 0.04, unit: 'image' } };
      },
    };
    const result = await runFeedback(
      {
        image,
        debit: trackedDebit([]),
        regenerateZone: noZone,
        loadRenderBase: async () => ({ base64: 'QUJD', mimeType: 'image/jpeg' }),
      },
      {
        organizationId: orgId,
        deliverableId,
        zone: { id: 'global', bbox: { x: 0, y: 0, width: 1, height: 1 } },
        instruction: 'suelo de madera',
        estimateCredits: 500,
      },
    );
    expect(base).toEqual({ base64: 'QUJD', mimeType: 'image/jpeg' });
    const created = await prisma.deliverable.findUnique({ where: { id: result.newDeliverableId } });
    expect(created?.zoneId).toBe(zoneRow.id);
  });

  it('la memoria se reescribe con la instrucción en una versión nueva', async () => {
    const orgId = await makeOrg(1000);
    const project = await prisma.project.create({ data: { organizationId: orgId, title: 'P' } });
    const del = await prisma.deliverable.create({
      data: {
        projectId: project.id,
        type: 'MEMORIA',
        payload: { type: 'memoria', markdown: '# Suelo\nMicrocemento' },
        legalSeal: DELIVERABLE_LEGAL_SEAL,
        version: 1,
      },
    });
    const seen: string[] = [];
    const result = await runFeedback(
      {
        image: okImage,
        debit: trackedDebit([]),
        regenerateZone: noZone,
        reviseMemoria: async (markdown, instruction) => {
          seen.push(markdown, instruction);
          return '# Suelo\nBaldosa';
        },
      },
      { organizationId: orgId, deliverableId: del.id, zone, instruction: 'cambia a baldosa', estimateCredits: 500 },
    );
    expect(seen).toEqual(['# Suelo\nMicrocemento', 'cambia a baldosa']);
    const created = await prisma.deliverable.findUnique({ where: { id: result.newDeliverableId } });
    expect(created?.type).toBe('MEMORIA');
    expect((created?.payload as { markdown: string }).markdown).toBe('# Suelo\nBaldosa');
  });

  it('el plano recibe la estancia actual para regenerarla', async () => {
    const orgId = await makeOrg(1000);
    const project = await prisma.project.create({ data: { organizationId: orgId, title: 'P' } });
    const room = {
      id: 'z0', name: 'Estancia', apertures: [], dimensions: [],
      outline: [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }],
      walls: [{ id: 'w0', from: { x: 0, y: 0 }, to: { x: 4000, y: 0 }, thicknessMm: 120 }],
    };
    const del = await prisma.deliverable.create({
      data: {
        projectId: project.id,
        type: 'PLANO_2D',
        payload: { type: 'plano2d', plano: { schemaVersion: 1, zones: [room] } },
        legalSeal: DELIVERABLE_LEGAL_SEAL,
        version: 1,
      },
    });
    let received: unknown;
    await runFeedback(
      {
        image: okImage,
        debit: trackedDebit([]),
        regenerateZone: async (_instruction, _zoneId, current) => {
          received = current;
          return { ...room, name: 'Salón' };
        },
      },
      { organizationId: orgId, deliverableId: del.id, zone, instruction: 'llámalo salón', planZoneId: 'z0', estimateCredits: 500 },
    );
    expect(received).toEqual(room);
  });
});

describe('runFeedback — idempotencia del cobro por intento', () => {
  beforeEach(resetDb);

  it('repetir la misma instrucción sobre el mismo diseño es otra operación y se cobra', async () => {
    const { orgId, deliverableId } = await makeRender();
    const keys: string[] = [];
    const debit: DebitService = {
      hold: async (k): Promise<Hold> => {
        keys.push(k);
        return { idempotencyKey: k, amount: 1 };
      },
      settle: async () => {},
      revert: async () => {},
    };
    const deps = { image: okImage, debit, regenerateZone: async () => { throw new Error('no se usa'); } };
    const req = { organizationId: orgId, deliverableId, zone, instruction: 'más luz', estimateCredits: 500 };
    await runFeedback(deps, req);
    await runFeedback(deps, req);
    expect(new Set(keys).size).toBe(2);
  });

  it('un reintento con el mismo attemptId reutiliza la clave', async () => {
    const { orgId, deliverableId } = await makeRender();
    const keys: string[] = [];
    const debit: DebitService = {
      hold: async (k): Promise<Hold> => {
        keys.push(k);
        return { idempotencyKey: k, amount: 1 };
      },
      settle: async () => {},
      revert: async () => {},
    };
    const deps = { image: okImage, debit, regenerateZone: async () => { throw new Error('no se usa'); } };
    const req = { organizationId: orgId, deliverableId, zone, instruction: 'más luz', estimateCredits: 500, attemptId: 'a1' };
    await runFeedback(deps, req);
    await runFeedback(deps, req);
    expect(new Set(keys).size).toBe(1);
  });

  it('un diseño borrado no se puede iterar', async () => {
    const { orgId, deliverableId } = await makeRender();
    await prisma.deliverable.update({ where: { id: deliverableId }, data: { deletedAt: new Date() } });
    await expect(runFeedback(
      { image: okImage, debit: trackedDebit([]), regenerateZone: async () => { throw new Error('no se usa'); } },
      { organizationId: orgId, deliverableId, zone, instruction: 'más luz', estimateCredits: 500 },
    )).rejects.toThrow();
  });
});
