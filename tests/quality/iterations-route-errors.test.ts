/**
 * Códigos de error del endpoint de iteraciones.
 *
 * 404 significa «ese diseño no existe»; cualquier otra cosa etiquetada como 404
 * engaña al cliente. Un error pensado para el usuario viaja con su mensaje y
 * 422; un fallo inesperado (BD, proveedor, storage) sale como 500 con un
 * mensaje fijo: `err.message` puede contener detalles internos.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  auth: vi.fn(async () => ({ organizationId: 'org-1', userId: 'user-1' })),
  loadDeliverable: vi.fn(),
  quality: vi.fn(),
  runFeedback: vi.fn(),
  buildDeps: vi.fn(async () => ({})),
}));

vi.mock('@/server/auth/require-org-context', () => ({ requireOrgContext: mocks.auth }));
vi.mock('@/server/privacy/consent-service', () => ({ assertConsent: vi.fn() }));
vi.mock('@/server/legal/tos-acceptance-service', () => ({ assertTosAccepted: vi.fn() }));
vi.mock('@/server/agent/feedback/iteration-repo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/server/agent/feedback/iteration-repo')>()),
  loadDeliverable: mocks.loadDeliverable,
}));
vi.mock('@/server/quality/instruction-gate', () => ({ assertInstructionQuality: mocks.quality }));
vi.mock('@/server/agent/feedback/feedback-deps', () => ({
  buildFeedbackDeps: mocks.buildDeps,
  ITERATION_CREDITS: 100,
}));
vi.mock('@/server/agent/feedback/feedback-orchestrator', () => ({ runFeedback: mocks.runFeedback }));

import { DeliverableNotFoundError } from '@/server/agent/feedback/iteration-repo';
import { UserFacingError } from '@/server/errors/user-facing-error';
import { POST } from '@/app/api/iterations/route';

function request() {
  return new Request('https://app.test/api/iterations', {
    method: 'POST',
    body: JSON.stringify({
      deliverableId: 'd1',
      zone: { id: 'global', bbox: { x: 0, y: 0, width: 1, height: 1 } },
      instruction: 'suelo de madera clara en el salón',
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  mocks.auth.mockResolvedValue({ organizationId: 'org-1', userId: 'user-1' });
  mocks.loadDeliverable.mockResolvedValue({ id: 'd1', projectId: 'p1', type: 'RENDER_3D', payload: {} });
  mocks.quality.mockResolvedValue({ score: 90, decision: 'proceed', reasons: [], failOpen: true });
  mocks.runFeedback.mockResolvedValue({ newDeliverableId: 'd2', version: 2 });
});

describe('POST /api/iterations', () => {
  it('404 solo cuando el entregable no existe', async () => {
    mocks.loadDeliverable.mockRejectedValue(new DeliverableNotFoundError());

    const response = await POST(request());
    expect(response.status).toBe(404);
  });

  it('422 con el mensaje del error cuando la puerta de calidad corta', async () => {
    mocks.quality.mockRejectedValue(new UserFacingError('Reformula la instrucción.'));

    const response = await POST(request());
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: 'Reformula la instrucción.' });
  });

  it('500 con mensaje fijo ante un fallo inesperado, sin filtrar el interno', async () => {
    mocks.quality.mockRejectedValue(new Error('connection to 10.0.0.3:5432 refused'));

    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'No se pudo completar la iteración.' });
  });

  it('un fallo de la generación tampoco se convierte en 404', async () => {
    mocks.runFeedback.mockRejectedValue(new Error('storage timeout'));

    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('storage');
  });

  it('entrega la iteración cuando todo va bien', async () => {
    const response = await POST(request());
    expect(response.status).toBe(201);
  });
});
