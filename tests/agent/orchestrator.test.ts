import { describe, it, expect, beforeEach } from 'vitest';
import { advance, type AgentDeps } from '@/server/agent/orchestrator';
import { prisma } from '@/server/db/prisma';
import { resetDb, makeOrg, makeUser } from '../helpers/db';
import { recordConsent } from '@/server/privacy/consent-service';
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
    };

    await expect(
      advance(noConsentDeps, project.id, {
        action: 'ingest',
        image: [{ type: 'text', text: 'img' }],
      }),
    ).rejects.toMatchObject({ purpose: 'IMAGE_PROCESSING' });
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
