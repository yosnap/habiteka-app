/**
 * «Pedir cambios» con la puerta de calidad delante.
 *
 * Lo que importa aquí es el ORDEN: la instrucción se juzga antes de reservar
 * créditos y antes de llamar a la IA de imagen. Con fiabilidad baja no se llega
 * a `runFeedback` (donde vive el cobro); con dudas, hace falta la confirmación
 * expresa y el servidor no se fía del cliente.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findProject: vi.fn(),
  loadDeliverable: vi.fn(),
  runFeedback: vi.fn(),
  buildDeps: vi.fn(),
  quality: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/server/auth/require-org-context', () => ({ requireOrgContext: mocks.auth }));
vi.mock('@/server/db/scoped-repo', () => ({
  withOrg: () => ({ projects: { findById: mocks.findProject }, zones: { list: async () => [] } }),
}));
vi.mock('@/server/privacy/consent-service', () => ({ assertConsent: vi.fn() }));
vi.mock('@/server/legal/tos-acceptance-service', () => ({ assertTosAccepted: vi.fn() }));
vi.mock('@/server/agent/feedback/iteration-repo', () => ({ loadDeliverable: mocks.loadDeliverable }));
vi.mock('@/server/agent/feedback/feedback-deps', () => ({
  buildFeedbackDeps: mocks.buildDeps,
  ITERATION_CREDITS: 100,
}));
vi.mock('@/server/agent/feedback/feedback-orchestrator', () => ({ runFeedback: mocks.runFeedback }));
// Se sustituye la evaluación (red + BD), no la puerta: así se ejerce la puerta real.
vi.mock('@/server/quality/evaluate', () => ({ evaluateCheckpointCached: mocks.quality }));

import {
  evaluateChangeInstruction,
  requestDeliverableChange,
} from '@/app/(app)/projects/[id]/_actions/deliverable-actions';

const PROJECT = 'proyecto-1';
const DELIVERABLE = 'del-1';
const INSTRUCTION = 'suelo de madera clara en el salón';

function verdict(decision: 'proceed' | 'confirm' | 'block') {
  const score = decision === 'proceed' ? 92 : decision === 'confirm' ? 70 : 30;
  return { score, decision, confidence: 0.8, reasons: ['motivo'], failOpen: true };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ organizationId: 'org', userId: 'user' });
  mocks.findProject.mockResolvedValue({ id: PROJECT });
  mocks.loadDeliverable.mockResolvedValue({
    id: DELIVERABLE,
    projectId: PROJECT,
    type: 'RENDER_3D',
    payload: { type: 'render3d', assetUrl: 'https://example.test/r.png' },
  });
  mocks.buildDeps.mockResolvedValue({});
  mocks.runFeedback.mockResolvedValue({ newDeliverableId: 'del-2', version: 2 });
});

describe('requestDeliverableChange con puerta de calidad', () => {
  it('con fiabilidad alta aplica el cambio', async () => {
    mocks.quality.mockResolvedValue(verdict('proceed'));
    await expect(requestDeliverableChange(PROJECT, DELIVERABLE, INSTRUCTION)).resolves.toEqual({
      newDeliverableId: 'del-2',
      version: 2,
    });
    expect(mocks.runFeedback).toHaveBeenCalledTimes(1);
  });

  it('bloqueada: ni reserva créditos ni llama a la IA', async () => {
    mocks.quality.mockResolvedValue(verdict('block'));
    const result = await requestDeliverableChange(PROJECT, DELIVERABLE, 'hazlo mejor');
    expect(result).toMatchObject({ actionError: expect.stringMatching(/reformules/) });
    expect(mocks.runFeedback).not.toHaveBeenCalled();
    expect(mocks.buildDeps).not.toHaveBeenCalled();
  });

  it('con dudas y sin confirmación rechaza; con confirmación sigue', async () => {
    mocks.quality.mockResolvedValue(verdict('confirm'));
    const rejected = await requestDeliverableChange(PROJECT, DELIVERABLE, INSTRUCTION);
    expect(rejected).toMatchObject({ actionError: expect.stringMatching(/Entiendo las dudas/) });
    expect(mocks.runFeedback).not.toHaveBeenCalled();

    await expect(
      requestDeliverableChange(PROJECT, DELIVERABLE, INSTRUCTION, undefined, true),
    ).resolves.toEqual({ newDeliverableId: 'del-2', version: 2 });
  });

  it('un diseño de otro proyecto no llega a evaluarse', async () => {
    mocks.loadDeliverable.mockResolvedValue({
      id: DELIVERABLE,
      projectId: 'otro',
      type: 'RENDER_3D',
      payload: {},
    });
    const result = await requestDeliverableChange(PROJECT, DELIVERABLE, INSTRUCTION);
    expect(result).toMatchObject({ actionError: expect.stringMatching(/no pertenece/) });
    expect(mocks.quality).not.toHaveBeenCalled();
  });
});

describe('evaluateChangeInstruction', () => {
  it('evalúa la misma zona marcada que utilizará el retoque', async () => {
    mocks.quality.mockResolvedValue(verdict('proceed'));
    const zone = { id: 'selected', bbox: { x: .2, y: .3, width: .15, height: .2 } };
    const text = 'En esta area marcada falta una puerta';
    await evaluateChangeInstruction(PROJECT, DELIVERABLE, text, zone);
    const previewEvidence = mocks.quality.mock.calls[0]?.[2];
    expect(previewEvidence).toMatchObject({ userInstruction: text, imageSelection: {
      scope: 'region', coordinateSystem: 'normalized-image-0-1', bounds: zone.bbox,
    } });
    expect(mocks.runFeedback).not.toHaveBeenCalled();

    await requestDeliverableChange(PROJECT, DELIVERABLE, text, undefined, false, zone);
    expect(mocks.quality.mock.calls[1]?.[2]).toEqual(previewEvidence);
    expect(mocks.runFeedback).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ zone }));
  });

  it('no consulta a Jev si la selección no es válida', async () => {
    const invalid = { id: 'bad', bbox: { x: .9, y: .1, width: .2, height: .2 } };
    await expect(evaluateChangeInstruction(PROJECT, DELIVERABLE, INSTRUCTION, invalid))
      .resolves.toMatchObject({ actionError: expect.any(String) });
    await expect(requestDeliverableChange(PROJECT, DELIVERABLE, INSTRUCTION, undefined, false, invalid))
      .resolves.toMatchObject({ actionError: expect.any(String) });
    expect(mocks.quality).not.toHaveBeenCalled();
    expect(mocks.runFeedback).not.toHaveBeenCalled();
  });

  it('devuelve el veredicto sin generar ni cobrar', async () => {
    mocks.quality.mockResolvedValue(verdict('confirm'));
    await expect(evaluateChangeInstruction(PROJECT, DELIVERABLE, INSTRUCTION)).resolves.toMatchObject({
      decision: 'confirm',
    });
    expect(mocks.runFeedback).not.toHaveBeenCalled();
  });

  it('rechaza una instrucción demasiado corta sin consultar a Jev', async () => {
    const result = await evaluateChangeInstruction(PROJECT, DELIVERABLE, 'a');
    expect(result).toMatchObject({ actionError: expect.any(String) });
    expect(mocks.quality).not.toHaveBeenCalled();
  });
});
