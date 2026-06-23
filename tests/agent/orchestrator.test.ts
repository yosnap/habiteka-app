import { describe, it, expect, beforeEach } from 'vitest';
import { advance, type AgentDeps } from '@/server/agent/orchestrator';
import { prisma } from '@/server/db/prisma';
import { resetDb, makeOrg, makeUser } from '../helpers/db';
import { recordConsent } from '@/server/privacy/consent-service';
import { acceptTos } from '@/server/legal/tos-acceptance-service';
import type { ChatVisionAdapter, ImageAdapter, DebitService, Hold } from '@/lib/contracts';

// Adaptadores de IA mockeados: structured outputs deterministas, sin red.
const chat: ChatVisionAdapter = {
  chat: async (req) => ({
    content: 'texto',
    structured: req.responseSchema
      ? req.responseSchema.properties?.walls
        ? { walls: 3, doors: 1, windows: 2, pillars: 0 }
        : { schemaVersion: 1, zones: [] }
      : undefined,
    usage: { promptTokens: 1, completionTokens: 1 },
  }),
  chatStream: async function* () {},
};
const image: ImageAdapter = {
  generate: async () => ({
    assetUrl: 'https://cdn/x.png',
    cost: { amountUsd: 0.04, unit: 'image' },
  }),
  inpaint: async () => ({ assetUrl: '', cost: { amountUsd: 0, unit: 'image' } }),
};
const noopDebit: DebitService = {
  hold: async (k): Promise<Hold> => ({ idempotencyKey: k, amount: 1 }),
  settle: async () => {},
  revert: async () => {},
};
let seq = 0;

// Crea proyecto + usuario miembro CON consentimiento de imagen (la ingesta lo
// exige). Devuelve el id de proyecto y unas deps cableadas con ese usuario.
async function makeProject(): Promise<{ pid: string; deps: AgentDeps }> {
  const org = await makeOrg(1000);
  const user = await makeUser();
  await prisma.member.create({
    data: { id: `m-${user.id}`, organizationId: org, userId: user.id, role: 'owner' },
  });
  await recordConsent({
    userId: user.id,
    organizationId: org,
    purpose: 'IMAGE_PROCESSING',
    policyVersion: 'test',
    granted: true,
  });
  const project = await prisma.project.create({ data: { organizationId: org, title: 'P' } });
  const deps: AgentDeps = {
    chat,
    image,
    debit: noopDebit,
    userId: user.id,
    newDeliverableId: () => `del-${++seq}`,
    resolveSourceImageId: async () => null,
  };
  return { pid: project.id, deps };
}

describe('orchestrator — flujo y concurrencia (Postgres real)', () => {
  beforeEach(resetDb);

  it('ingesta → confirmar → cualificar persiste el avance de fase', async () => {
    const { pid, deps } = await makeProject();
    await advance(deps, pid, { action: 'ingest', image: [{ type: 'text', text: 'img' }] });
    const afterIngest = await prisma.agentState.findUnique({ where: { projectId: pid } });
    expect(afterIngest?.phase).toBe('ingesta');
    expect((afterIngest?.collected as { detected?: unknown }).detected).toBeTruthy();

    const confirm = await advance(deps, pid, { action: 'confirm-detection' });
    expect(confirm.phase).toBe('cualificacion');
  });

  it('entregar sin estilo lanza legal_block sin generar', async () => {
    const { pid, deps } = await makeProject();
    // Lleva el estado a cualificación con detección confirmada pero sin estilo.
    await advance(deps, pid, { action: 'ingest', image: [{ type: 'text', text: 'img' }] });
    await advance(deps, pid, { action: 'confirm-detection' });

    await expect(advance(deps, pid, { action: 'deliver' })).rejects.toMatchObject({
      kind: 'legal_block',
    });
  });

  it('ingesta sin consentimiento de imagen se bloquea (RGPD)', async () => {
    const org = await makeOrg(1000);
    const user = await makeUser();
    await prisma.member.create({
      data: { id: `m-${user.id}`, organizationId: org, userId: user.id, role: 'owner' },
    });
    // SIN recordConsent: el usuario no ha consentido el tratamiento de imágenes.
    const project = await prisma.project.create({ data: { organizationId: org, title: 'P' } });
    const noConsentDeps: AgentDeps = {
      chat,
      image,
      debit: noopDebit,
      userId: user.id,
      newDeliverableId: () => `del-${++seq}`,
      resolveSourceImageId: async () => null,
    };

    await expect(
      advance(noConsentDeps, project.id, {
        action: 'ingest',
        image: [{ type: 'text', text: 'img' }],
      }),
    ).rejects.toMatchObject({ purpose: 'IMAGE_PROCESSING' });
  });

  it('generate-from-canvas: pide explicación solo si hay render3d y degrada si el chat falla', async () => {
    const { pid, deps } = await makeProject();
    await acceptTos(deps.userId); // generate-from-canvas exige ToS aceptado.

    // Chat que SIEMPRE falla: simula el fallo de la 2ª llamada (explicación).
    // La rama render3d solo usa el chat para la explicación, así que esto aísla (b).
    const failingChat: ChatVisionAdapter = {
      chat: async () => {
        throw new Error('chat caído');
      },
      chatStream: async function* () {},
    };
    const depsFailExplain: AgentDeps = { ...deps, chat: failingChat };

    const out = await advance(depsFailExplain, pid, {
      action: 'generate-from-canvas',
      estilo: 'nordico',
      entregable: 'render3d',
      objetivo: '',
      promptLibre: 'haz la sala más cálida',
      description: 'Sofá: junto a la pared del fondo',
      referenceImage: { base64: 'QUJD', mimeType: 'image/png' },
      aspectRatio: '3:2',
      requestId: `req-${++seq}`,
    });

    // Degradación elegante: el render se entrega aunque la explicación falle.
    expect(out.deliverables?.some((d) => d.payload.type === 'render3d')).toBe(true);
    expect(out.explanation).toBeUndefined();
  });

  it('generate-from-canvas: un entregable no-render (memoria) no pide explicación', async () => {
    const { pid, deps } = await makeProject();
    await acceptTos(deps.userId);

    // chat global devuelve content 'texto'; si se pidiera explicación, saldría.
    const out = await advance(deps, pid, {
      action: 'generate-from-canvas',
      estilo: 'nordico',
      entregable: 'memoria',
      objetivo: 'reformar',
      promptLibre: '',
      description: 'Sofá: junto a la pared del fondo',
      referenceImage: { base64: 'QUJD', mimeType: 'image/png' },
      aspectRatio: '3:2',
      requestId: `req-${++seq}`,
    });

    // Sin render3d entre los entregables, no se genera explicación.
    expect(out.deliverables?.some((d) => d.payload.type === 'render3d')).toBe(false);
    expect(out.explanation).toBeUndefined();
  });

  it('si la generación falla, la fase NO avanza a feedback (el usuario puede reintentar)', async () => {
    const { pid, deps } = await makeProject();
    await acceptTos(deps.userId);
    // Lleva el estado a cualificación con estilo + entregables listos para entregar.
    await advance(deps, pid, { action: 'ingest', image: [{ type: 'text', text: 'img' }] });
    await advance(deps, pid, { action: 'confirm-detection' });
    const st = await prisma.agentState.findUnique({ where: { projectId: pid } });
    await prisma.agentState.update({
      where: { projectId: pid },
      data: {
        collected: {
          ...(st?.collected as object),
          estilo: 'nordico',
          entregables: ['render3d'],
        },
      },
    });

    // El generador de imagen falla: la entrega lanza y la fase debe quedarse en cualificación.
    const failingImage: ImageAdapter = {
      generate: async () => {
        throw new Error('proveedor de imagen caído');
      },
      inpaint: async () => ({ assetUrl: '', cost: { amountUsd: 0, unit: 'image' } }),
    };
    const depsFailImage: AgentDeps = { ...deps, image: failingImage };

    await expect(advance(depsFailImage, pid, { action: 'deliver' })).rejects.toBeTruthy();

    const after = await prisma.agentState.findUnique({ where: { projectId: pid } });
    expect(after?.phase).toBe('cualificacion'); // NO avanzó a feedback
    // Y no quedó ningún entregable persistido a medias.
    const dels = await prisma.deliverable.count({ where: { projectId: pid } });
    expect(dels).toBe(0);
  });

  it('dos avances concurrentes con la misma versión: uno gana, otro conflict', async () => {
    const { pid, deps } = await makeProject();
    // Estado inicial creado por la primera carga.
    await advance(deps, pid, { action: 'ingest', image: [{ type: 'text', text: 'img' }] });

    // Dos confirmaciones concurrentes parten de la misma versión persistida.
    const results = await Promise.allSettled([
      advance(deps, pid, { action: 'confirm-detection' }),
      advance(deps, pid, { action: 'confirm-detection' }),
    ]);
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(rejected.length).toBe(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ kind: 'conflict' });
  });
});
