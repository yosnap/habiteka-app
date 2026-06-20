import { describe, it, expect, beforeEach } from 'vitest';
import { advance, type AgentDeps } from '@/server/agent/orchestrator';
import { prisma } from '@/server/db/prisma';
import { resetDb, makeOrg } from '../helpers/db';
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
const deps: AgentDeps = { chat, image, debit: noopDebit, newDeliverableId: () => `del-${++seq}` };

async function makeProject(): Promise<string> {
  const org = await makeOrg(1000);
  const project = await prisma.project.create({ data: { organizationId: org, title: 'P' } });
  return project.id;
}

describe('orchestrator — flujo y concurrencia (Postgres real)', () => {
  beforeEach(resetDb);

  it('ingesta → confirmar → cualificar persiste el avance de fase', async () => {
    const pid = await makeProject();
    await advance(deps, pid, { action: 'ingest', image: [{ type: 'text', text: 'img' }] });
    const afterIngest = await prisma.agentState.findUnique({ where: { projectId: pid } });
    expect(afterIngest?.phase).toBe('ingesta');
    expect((afterIngest?.collected as { detected?: unknown }).detected).toBeTruthy();

    const confirm = await advance(deps, pid, { action: 'confirm-detection' });
    expect(confirm.phase).toBe('cualificacion');
  });

  it('entregar sin estilo lanza legal_block sin generar', async () => {
    const pid = await makeProject();
    // Lleva el estado a cualificación con detección confirmada pero sin estilo.
    await advance(deps, pid, { action: 'ingest', image: [{ type: 'text', text: 'img' }] });
    await advance(deps, pid, { action: 'confirm-detection' });

    await expect(advance(deps, pid, { action: 'deliver' })).rejects.toMatchObject({
      kind: 'legal_block',
    });
  });

  it('dos avances concurrentes con la misma versión: uno gana, otro conflict', async () => {
    const pid = await makeProject();
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
