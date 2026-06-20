import { describe, it, expect } from 'vitest';
import { runDelivery, type DeliveryDeps } from '@/server/agent/phases/entrega';
import { DELIVERABLE_LEGAL_SEAL } from '@/server/agent/legal/seal';
import type { ReadyForDelivery, Hold, OperationCost } from '@/lib/contracts';

const ready: ReadyForDelivery = {
  estilo: 'moderno',
  entregables: ['plano2d', 'render3d', 'memoria'],
  objetivo: 'reformar el salón',
};

// Mocks deterministas con registro del orden de llamadas al débito.
function makeDeps(opts: { failImage?: boolean } = {}): { deps: DeliveryDeps; calls: string[] } {
  const calls: string[] = [];
  const deps: DeliveryDeps = {
    chat: {
      chat: async () => ({
        content: 'memoria',
        structured: { schemaVersion: 1, zones: [] },
        usage: { promptTokens: 1, completionTokens: 1 },
      }),
      chatStream: async function* () {},
    },
    image: {
      generate: async () => {
        calls.push('generate');
        if (opts.failImage) throw new Error('proveedor caído');
        return { assetUrl: 'https://cdn/x.png', cost: { amountUsd: 0.04, unit: 'image' } };
      },
      inpaint: async () => ({ assetUrl: '', cost: { amountUsd: 0, unit: 'image' } }),
    },
    debit: {
      hold: async (idempotencyKey: string): Promise<Hold> => {
        calls.push('hold');
        return { idempotencyKey, amount: 1 };
      },
      settle: async (_h: Hold, _c: OperationCost) => {
        calls.push('settle');
      },
      revert: async (_h: Hold) => {
        calls.push('revert');
      },
    },
    newId: (type) => `id-${type}`,
  };
  return { deps, calls };
}

const input = {
  projectId: 'p1',
  collected: ready,
  idempotencyKey: 'deliver:p1:v0',
  estimateCredits: 1000,
};

describe('runDelivery — reserva/confirma/revierte y sello', () => {
  it('reserva antes de generar y confirma al final (orden hold→generate→settle)', async () => {
    const { deps, calls } = makeDeps();
    const out = await runDelivery(deps, input);
    expect(calls[0]).toBe('hold');
    expect(calls).toContain('generate');
    expect(calls.at(-1)).toBe('settle');
    expect(calls).not.toContain('revert');
    expect(out).toHaveLength(3);
  });

  it('todo entregable lleva el sello legal inyectado por el servidor', async () => {
    const { deps } = makeDeps();
    const out = await runDelivery(deps, input);
    for (const d of out) {
      expect(d.legalSeal).toBe(DELIVERABLE_LEGAL_SEAL);
    }
  });

  it('si la generación falla, revierte la reserva y no confirma', async () => {
    const { deps, calls } = makeDeps({ failImage: true });
    await expect(runDelivery(deps, input)).rejects.toBeTruthy();
    expect(calls).toContain('hold');
    expect(calls).toContain('revert');
    expect(calls).not.toContain('settle');
  });
});
