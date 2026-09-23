/**
 * Evaluación de calidad del editor para el diálogo de generación.
 *
 * Juzga el documento QUE MANDA EL CLIENTE, el mismo que evaluará la puerta al
 * generar: si juzgara el documento guardado, la tarjeta y el servidor hablarían
 * de planos distintos (tarjeta «alta», servidor pidiendo confirmar) y se pagaría
 * a Jev dos veces. Además valida y acota la entrada, como las generaciones.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  auth: vi.fn(async () => ({ organizationId: 'org-1', userId: 'user-1' })),
  findProject: vi.fn(async (): Promise<{ id: string } | null> => ({ id: 'p1' })),
  evaluate: vi.fn(),
}));

vi.mock('@/server/auth/require-org-context', () => ({ requireOrgContext: mocks.auth }));
vi.mock('@/server/db/scoped-repo', () => ({
  withOrg: () => ({ projects: { findById: mocks.findProject } }),
}));
vi.mock('@/server/quality/evaluate', () => ({
  evaluateCheckpointCached: mocks.evaluate,
  evaluateCheckpoint: mocks.evaluate,
}));

import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { evaluateEditorQuality } from '@/app/(app)/projects/[id]/_actions/editor-quality-actions';

function room() {
  return addWallPath(
    emptyEditorDocument(),
    [
      { x: 0, y: 0 },
      { x: 4000, y: 0 },
      { x: 4000, y: 3000 },
      { x: 0, y: 3000 },
    ],
    true,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ organizationId: 'org-1', userId: 'user-1' });
  mocks.findProject.mockResolvedValue({ id: 'p1' });
  mocks.evaluate.mockResolvedValue({
    score: 92,
    decision: 'proceed',
    confidence: 0.9,
    reasons: [],
    failOpen: true,
  });
});

describe('evaluateEditorQuality', () => {
  it('evalúa la evidencia del documento del cliente, no la del guardado', async () => {
    const result = await evaluateEditorQuality('p1', room(), null);

    expect(result).toMatchObject({ score: 92, decision: 'proceed' });
    const [, checkpoint, evidence] = mocks.evaluate.mock.calls[0]!;
    expect(checkpoint).toBe('editor_structure');
    // Cuatro muros: los del documento que ha mandado el cliente.
    expect(evidence).toMatchObject({ muros: 4 });
  });

  it('es informativa: no marca ninguna acción de pago', async () => {
    await evaluateEditorQuality('p1', room(), null);
    expect(mocks.evaluate.mock.calls[0]![4]).toBeUndefined();
  });

  it('rechaza un proyecto de otra organización antes de evaluar', async () => {
    mocks.findProject.mockResolvedValue(null);

    await expect(evaluateEditorQuality('ajeno', room(), null)).resolves.toMatchObject({
      actionError: expect.stringContaining('no encontrado'),
    });
    expect(mocks.evaluate).not.toHaveBeenCalled();
  });

  it('rechaza un documento inválido sin llamar a Jev', async () => {
    await expect(evaluateEditorQuality('p1', { walls: 'no' }, null)).rejects.toThrow();
    expect(mocks.evaluate).not.toHaveBeenCalled();
  });
});
