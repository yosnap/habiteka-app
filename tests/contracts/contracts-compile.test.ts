/**
 * Typecheck-como-test: este módulo importa los 11 contratos desde el barrel y
 * construye un valor de cada uno con datos válidos. Si falta un contrato o un
 * tipo cambia de forma incompatible, el archivo NO compila y el test falla.
 *
 * No ejerce comportamiento (los contratos son tipos puros); su valor es que
 * `tsc` lo incluye en la compilación y `vitest` confirma que el módulo carga.
 */
import { describe, it, expect } from 'vitest';
import type {
  TokenUsage,
  ProviderCost,
  ChatVisionAdapter,
  ChatRequest,
  ImageAdapter,
  CanvasZone,
  Plano2dPayload,
  DesignElement,
  Deliverable,
  AgentState,
  AgentStreamEvent,
  ProductDrop,
  DebitService,
} from '@/lib/contracts';

const usage: TokenUsage = { promptTokens: 10, completionTokens: 20 };
const cost: ProviderCost = { amountUsd: 0.03, unit: 'image' };

const chatRequest: ChatRequest = {
  messages: [{ role: 'user', content: [{ type: 'text', text: 'hola' }] }],
  model: 'anthropic/claude-3.7-sonnet',
  fallbackModels: ['openai/gpt-4o'],
};

const zone: CanvasZone = {
  id: 'z1',
  bbox: { x: 0.1, y: 0.1, width: 0.5, height: 0.5 },
};

const plano: Plano2dPayload = {
  schemaVersion: 1,
  zones: [
    {
      id: 'salon',
      name: 'Salón',
      outline: [
        { x: 0, y: 0 },
        { x: 3200, y: 0 },
        { x: 3200, y: 2800 },
        { x: 0, y: 2800 },
      ],
      walls: [{ id: 'w1', from: { x: 0, y: 0 }, to: { x: 3200, y: 0 }, thicknessMm: 120 }],
      apertures: [{ id: 'a1', kind: 'puerta', wallId: 'w1', position: 0.5, widthMm: 800 }],
      dimensions: [{ id: 'd1', from: { x: 0, y: 0 }, to: { x: 3200, y: 0 }, label: '3.20 m' }],
    },
  ],
};

const element: DesignElement = { id: 'e1', kind: 'puerta', targetRef: 'salon' };

const deliverable: Deliverable = {
  id: 'del1',
  type: 'plano2d',
  payload: { type: 'plano2d', plano },
  legalSeal: '[ Documento conceptual generado por Habiteka AI - Revisión técnica requerida ]',
  version: 1,
  elements: [element],
};

const state: AgentState = {
  phase: 'entrega',
  projectId: 'proj1',
  collected: { estilo: 'moderno', entregables: ['plano2d'] },
  deliverables: [deliverable],
  updatedAt: '2026-06-20T00:00:00.000Z',
};

const streamEvents: AgentStreamEvent[] = [
  { type: 'text-delta', text: 'hola' },
  { type: 'tool-call', name: 'detectStructure', visible: false },
  { type: 'phase', phase: 'cualificacion' },
  { type: 'error', message: 'boom' },
  { type: 'done' },
];

const drop: ProductDrop = { marketplaceItemId: 'm1', stageX: 100, stageY: 200 };

// Stubs que satisfacen las interfaces de adaptador/servicio: confirman que los
// contratos son IMPLEMENTABLES (no solo importables) sin llamar a servicios.
const chatStub: ChatVisionAdapter = {
  chat: async () => ({ content: '', usage }),
  chatStream: async function* () {
    /* sin emisiones en el stub */
  },
};
const imageStub: ImageAdapter = {
  generate: async () => ({ assetUrl: 'about:blank', cost }),
  inpaint: async () => ({ assetUrl: 'about:blank', cost }),
};
const debitStub: DebitService = {
  hold: async (idempotencyKey) => ({ idempotencyKey, amount: 0 }),
  settle: async () => {},
  revert: async () => {},
};

describe('contratos transversales', () => {
  it('los 11 contratos compilan y construyen valores válidos', () => {
    expect(usage.promptTokens + usage.completionTokens).toBe(30);
    expect(cost.unit).toBe('image');
    expect(chatRequest.fallbackModels?.length).toBe(1);
    expect(zone.bbox?.width).toBe(0.5);
    expect(plano.zones[0]?.apertures[0]?.kind).toBe('puerta');
    expect(element.targetRef).toBe('salon');
    expect(deliverable.legalSeal).toContain('Habiteka AI');
    expect(state.phase).toBe('entrega');
    expect(streamEvents.length).toBe(5);
    expect(drop.marketplaceItemId).toBe('m1');
  });

  it('los adaptadores y el servicio de débito son implementables', async () => {
    expect((await chatStub.chat(chatRequest)).usage).toEqual(usage);
    expect((await imageStub.generate({ prompt: 'x' })).cost).toEqual(cost);
    expect((await debitStub.hold('del1:v1', { kind: 'tokens', usage })).amount).toBe(0);
  });
});
