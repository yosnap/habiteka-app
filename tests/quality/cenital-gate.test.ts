/**
 * Puerta de calidad de las vistas cenitales (estudio del plano).
 *
 * Una vista cenital es una generación de PAGO: resuelve el adaptador de imagen
 * y cobra. Lo que se comprueba es el orden y la autoridad del veredicto:
 *
 *  - con el plano bloqueado no se llega a resolver el adaptador (no se cobra);
 *  - con dudas hace falta confirmación expresa, validada en el servidor;
 *  - sin evidencia estructurada se falla en cerrado (confirmar), nunca seguir;
 *  - el veredicto sale del estado guardado del estudio, no del cliente.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  auth: vi.fn(async () => ({ organizationId: 'org-1', userId: 'user-1' })),
  loadStudio: vi.fn(),
  saveStudio: vi.fn(async () => undefined),
  imageAdapter: vi.fn(async () => ({ id: 'adapter' })),
  generateCenitalFromImage: vi.fn(async () => ({ assetUrl: 'https://cdn/cenital.png' })),
  evaluateCheckpoint: vi.fn(),
}));

vi.mock('@/server/auth/require-org-context', () => ({ requireOrgContext: mocks.auth }));
vi.mock('@/server/plan/studio-repo', () => ({
  loadStudio: mocks.loadStudio,
  saveStudio: mocks.saveStudio,
}));
vi.mock('@/server/privacy/consent-service', () => ({ assertConsent: vi.fn() }));
vi.mock('@/server/legal/tos-acceptance-service', () => ({ assertTosAccepted: vi.fn() }));
vi.mock('@/server/ai', () => ({
  getImageAdapterForAction: mocks.imageAdapter,
  getChatVisionAdapter: vi.fn(),
}));
vi.mock('@/server/ai/design/cenital-pipeline', () => ({
  generateCenitalFromImage: mocks.generateCenitalFromImage,
  generateCenital: vi.fn(),
  assertPlanoRasterizable: vi.fn(),
}));
vi.mock('@/server/plan/studio-image', () => ({
  readStudioImage: vi.fn(async () => ({ base64: 'AAAA', mimeType: 'image/png' })),
  persistStudioSource: vi.fn(),
}));
// Se sustituye la llamada a Jev (red + BD), no la puerta: la puerta real decide.
vi.mock('@/server/quality/evaluate', () => ({
  evaluateCheckpoint: mocks.evaluateCheckpoint,
  evaluateCheckpointCached: mocks.evaluateCheckpoint,
}));

import { cenitalStudio } from '@/app/(app)/projects/[id]/_actions/studio-actions';

const PLAN = { assetUrl: 'https://cdn/plan.png', assetKey: 'plan-key' };

function studio(quality: unknown) {
  return { plan: PLAN, source: PLAN, ...(quality ? { quality } : {}) };
}

function verdict(decision: string, score: number | null = 50) {
  return { score, decision, reasons: ['La lectura del plano no es fiable.'], failOpen: true };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ organizationId: 'org-1', userId: 'user-1' });
  mocks.imageAdapter.mockResolvedValue({ id: 'adapter' });
  mocks.generateCenitalFromImage.mockResolvedValue({ assetUrl: 'https://cdn/cenital.png' });
});

describe('puerta de calidad de la vista cenital', () => {
  it('con el plano bloqueado no resuelve el adaptador ni genera', async () => {
    mocks.loadStudio.mockResolvedValue(studio(verdict('block', 30)));

    const result = await cenitalStudio('p1', '', 'moderno');

    expect(result).toMatchObject({ actionError: expect.stringContaining('no hemos gastado nada') });
    expect(mocks.imageAdapter).not.toHaveBeenCalled();
    expect(mocks.generateCenitalFromImage).not.toHaveBeenCalled();
  });

  it('con dudas exige confirmación expresa validada en el servidor', async () => {
    mocks.loadStudio.mockResolvedValue(studio(verdict('confirm', 70)));

    const sinConfirmar = await cenitalStudio('p1', '', 'moderno');
    expect(sinConfirmar).toMatchObject({
      actionError: expect.stringContaining('Entiendo las dudas'),
    });
    expect(mocks.imageAdapter).not.toHaveBeenCalled();

    const confirmado = await cenitalStudio('p1', '', 'moderno', '', 'cenital', true);
    expect(confirmado).toMatchObject({ imageUrl: 'https://cdn/cenital.png' });
    expect(mocks.generateCenitalFromImage).toHaveBeenCalledTimes(1);
  });

  it('con fiabilidad alta genera sin preguntar', async () => {
    mocks.loadStudio.mockResolvedValue(studio(verdict('proceed', 95)));

    await expect(cenitalStudio('p1', '', 'moderno')).resolves.toMatchObject({
      imageUrl: 'https://cdn/cenital.png',
    });
  });

  it('sin geometría leída falla en cerrado: pide confirmar, nunca sigue solo', async () => {
    mocks.loadStudio.mockResolvedValue(studio(null));

    const result = await cenitalStudio('p1', '', 'moderno');
    expect(result).toMatchObject({ actionError: expect.stringContaining('Entiendo las dudas') });
    expect(mocks.imageAdapter).not.toHaveBeenCalled();
    // No hay evidencia que mandar a Jev: no se gasta una evaluación tampoco.
    expect(mocks.evaluateCheckpoint).not.toHaveBeenCalled();
  });

  it('sin veredicto guardado pero con extracción, evalúa en el momento y marca el corte', async () => {
    mocks.loadStudio.mockResolvedValue({
      plan: PLAN,
      source: PLAN,
      planImport: {
        raw: { muros: [], habitaciones: [], aberturas: [], muebles: [] },
        detected: null,
        image: PLAN,
      },
    });
    mocks.evaluateCheckpoint.mockResolvedValue({
      score: 20,
      decision: 'block',
      confidence: 0.9,
      reasons: ['No se ha podido cerrar ninguna estancia.'],
      failOpen: true,
    });

    const result = await cenitalStudio('p1', '', 'moderno');

    expect(result).toMatchObject({ actionError: expect.stringContaining('no hemos gastado nada') });
    expect(mocks.imageAdapter).not.toHaveBeenCalled();
    // La evaluación queda marcada como paso de puerta de esta acción concreta.
    expect(mocks.evaluateCheckpoint).toHaveBeenCalledWith(
      expect.anything(),
      'plan_extraction',
      expect.anything(),
      expect.anything(),
      { action: 'cenital_estudio' },
    );
  });
});
