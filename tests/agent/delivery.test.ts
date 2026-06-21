import { describe, it, expect } from 'vitest';
import {
  runDelivery,
  explanationPrompt,
  memoriaPrompt,
  type DeliveryDeps,
} from '@/server/agent/phases/entrega';
import { DELIVERABLE_LEGAL_SEAL } from '@/server/agent/legal/seal';
import type { ReadyForDelivery, Hold, ImageGenRequest } from '@/lib/contracts';

const ready: ReadyForDelivery = {
  estilo: 'moderno',
  entregables: ['plano2d', 'render3d', 'memoria'],
  objetivo: 'reformar el salón',
};

// Mocks deterministas con registro del orden de llamadas al débito.
function makeDeps(opts: { failImage?: boolean } = {}): {
  deps: DeliveryDeps;
  calls: string[];
  imageRequests: ImageGenRequest[];
} {
  const calls: string[] = [];
  const imageRequests: ImageGenRequest[] = [];
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
      generate: async (req) => {
        calls.push('generate');
        imageRequests.push(req);
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
      settle: async () => {
        calls.push('settle');
      },
      revert: async () => {
        calls.push('revert');
      },
    },
    newId: (type) => `id-${type}`,
  };
  return { deps, calls, imageRequests };
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

  it('sin sketch, el render no envía imagen de referencia', async () => {
    const { deps, imageRequests } = makeDeps();
    await runDelivery(deps, { ...input, collected: { ...ready, entregables: ['render3d'] } });
    expect(imageRequests[0]?.referenceImage).toBeUndefined();
  });

  it('con sketch (lienzo), el render recibe referenceImage y la descripción en el prompt', async () => {
    const { deps, imageRequests } = makeDeps();
    await runDelivery(deps, {
      ...input,
      collected: { ...ready, entregables: ['render3d'] },
      sketch: {
        description: 'Sofá: junto a la pared del fondo, a la izquierda',
        referenceImage: { base64: 'QUJD', mimeType: 'image/png' },
        aspectRatio: '3:2',
      },
    });
    const req = imageRequests[0];
    expect(req?.referenceImage).toEqual({ base64: 'QUJD', mimeType: 'image/png' });
    expect(req?.prompt).toContain('Sofá: junto a la pared del fondo');
    // La proporción de la sala se traslada al encuadre del render (no el 16:9 fijo).
    expect(req?.aspectRatio).toBe('3:2');
  });

  it('sin prompt libre, el prompt del render no añade instrucción de usuario', async () => {
    const { deps, imageRequests } = makeDeps();
    await runDelivery(deps, {
      ...input,
      collected: { ...ready, entregables: ['render3d'] },
      sketch: {
        description: 'Sofá: junto a la pared del fondo',
        referenceImage: { base64: 'QUJD', mimeType: 'image/png' },
        aspectRatio: '3:2',
      },
    });
    expect(imageRequests[0]?.prompt).not.toContain('el usuario pide');
  });

  it('con prompt libre, el render lo incluye reforzando no mover la disposición', async () => {
    const { deps, imageRequests } = makeDeps();
    await runDelivery(deps, {
      ...input,
      collected: { ...ready, entregables: ['render3d'] },
      sketch: {
        description: 'Sofá: junto a la pared del fondo',
        referenceImage: { base64: 'QUJD', mimeType: 'image/png' },
        aspectRatio: '3:2',
        promptLibre: 'haz la sala más cálida',
      },
    });
    const prompt = imageRequests[0]?.prompt ?? '';
    expect(prompt).toContain('haz la sala más cálida');
    expect(prompt.toLowerCase()).toContain('sin cambiar la disposición');
    // La descripción del plano sigue presente (la disposición manda).
    expect(prompt).toContain('Sofá: junto a la pared del fondo');
  });
});

describe('explanationPrompt — texto para la 2ª llamada de chat', () => {
  it('incorpora el prompt libre del usuario cuando existe', () => {
    const out = explanationPrompt({
      ...input,
      collected: { ...ready, entregables: ['render3d'] },
      sketch: {
        description: 'Sofá al fondo',
        referenceImage: { base64: 'QUJD', mimeType: 'image/png' },
        aspectRatio: '3:2',
        promptLibre: 'añade plantas',
      },
    });
    expect(out).toContain('añade plantas');
    expect(out.toLowerCase()).toContain('explica');
  });

  it('cae al objetivo si no hay prompt libre', () => {
    const out = explanationPrompt({
      ...input,
      collected: { ...ready, objetivo: 'reformar el salón', entregables: ['render3d'] },
    });
    expect(out).toContain('reformar el salón');
  });
});

describe('memoriaPrompt — borrador de materiales (F5b)', () => {
  it('pide materiales por secciones según estilo y objetivo', () => {
    const out = memoriaPrompt({
      ...input,
      collected: { ...ready, estilo: 'nordico', objetivo: 'salón acogedor', entregables: ['memoria'] },
    });
    expect(out).toContain('nordico');
    expect(out).toContain('salón acogedor');
    expect(out).toContain('Suelo');
    expect(out).toContain('Paleta de color');
  });

  it('incorpora la descripción del plano (con medidas) cuando hay sketch', () => {
    const out = memoriaPrompt({
      ...input,
      collected: { ...ready, entregables: ['memoria'] },
      sketch: {
        description: 'La sala mide 5,2 m por 3,6 m. Sofá: junto a la pared del fondo',
        referenceImage: { base64: 'QUJD', mimeType: 'image/png' },
        aspectRatio: '3:2',
      },
    });
    expect(out).toContain('5,2 m por 3,6 m');
    expect(out.toLowerCase()).toContain('cantidades');
  });

  it('sin sketch no menciona el plano', () => {
    const out = memoriaPrompt({ ...input, collected: { ...ready, entregables: ['memoria'] } });
    expect(out).not.toContain('plano del espacio');
  });
});
