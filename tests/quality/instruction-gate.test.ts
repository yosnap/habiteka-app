/**
 * Puerta de calidad de las instrucciones de cambio, ANTES de gastar.
 *
 * Lo que se comprueba es exactamente lo que cuesta dinero: una instrucción
 * clara pasa; una dudosa exige confirmación expresa; una inservible no llega a
 * la IA; y si Jev no responde se falla en cerrado (confirmar, nunca seguir
 * solo). El prompt libre del editor solo corta con fiabilidad baja: la
 * confirmación del plano ya la pide la puerta del editor, y no se piden dos.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
// `evaluate` y el resolutor de claves importan 'server-only'; en Vitest no hay Server Components.
vi.mock('server-only', () => ({}));
import {
  assertFreePromptQuality,
  assertInstructionQuality,
  instructionQuality,
  CHANGE_INSTRUCTION_CHECKPOINT,
} from '@/server/quality/instruction-gate';
import {
  buildInstructionEvidence,
  instructionTargetOf,
} from '@/server/quality/evidence/instruction-evidence';
import { QUALITY_THRESHOLDS_KEY } from '@/server/quality/evaluate';
import { buildEditorInstructionContext } from '@/server/quality/evidence/editor-instruction-context';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { defaultRenderDesignOptions } from '@/lib/editor-document/render-design-options';
import { prisma } from '@/server/db/prisma';
import { sealSecret } from '@/server/security/secret-box';
import { resetDb } from '../helpers/db';

const CTX = { organizationId: 'org-instruction', userId: 'user-instruction' };
const SCOPE = { projectId: 'proyecto-1', refId: 'del-1' };

function jevResponse(score: number, noul: number, choice: string): Response {
  return new Response(
    JSON.stringify({
      model: 'jev-latest',
      answers: {
        actionable: { type: 'noul', noul },
        specific: { type: 'score', score, confidence: 0.8 },
        compatible: { type: 'noul', noul },
        feasible: { type: 'noul', noul },
        main_issue: { type: 'choice', choice },
      },
      usage: { input_tokens: 800 },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

const fetchMock = vi.fn();

/** Doble del modelo de imagen: cuenta las generaciones que se habrían cobrado. */
const imageAdapter = vi.fn(async () => ({ assetUrl: 'https://example.test/render.png' }));

/** Misma secuencia que la acción: primero la puerta, después el gasto. */
async function changeWithGate(instruction: string, ack = false) {
  await assertInstructionQuality(CTX, SCOPE, 'render3d', instruction, ack);
  return imageAdapter();
}

async function withKey() {
  await prisma.aiProviderCredential.create({
    data: {
      provider: 'typesafe',
      encryptedApiKey: sealSecret('sk-test-jev-123456'),
      keyHint: 'sk-…3456',
      enabled: true,
    },
  });
}

beforeEach(async () => {
  await resetDb();
  await prisma.aiQualityEvaluation.deleteMany();
  await prisma.aiProviderCredential.deleteMany({ where: { provider: 'typesafe' } });
  await prisma.systemSetting.deleteMany({ where: { key: QUALITY_THRESHOLDS_KEY } });
  fetchMock.mockReset();
  imageAdapter.mockClear();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('evidencia de la instrucción', () => {
  it('recorta el texto y describe el ámbito del entregable', () => {
    const evidence = buildInstructionEvidence('memoria', `  ${'a'.repeat(900)}  `);
    expect(evidence.chars).toBe(500);
    expect(evidence.deliverableScope).toMatch(/materials report/i);
  });

  it('traduce el tipo de entregable de la base de datos', () => {
    expect(instructionTargetOf('PLANO_2D')).toBe('plano2d');
    expect(instructionTargetOf('MEMORIA')).toBe('memoria');
    expect(instructionTargetOf('RENDER_3D')).toBe('render3d');
  });
});

describe('assertInstructionQuality', () => {
  it('con una instrucción clara aplica el cambio y registra la evaluación', async () => {
    await withKey();
    fetchMock.mockImplementation(async () => jevResponse(4, 0.98, 'none'));

    await expect(changeWithGate('suelo de madera clara en el salón')).resolves.toBeDefined();
    expect(imageAdapter).toHaveBeenCalledTimes(1);

    const row = await prisma.aiQualityEvaluation.findFirstOrThrow();
    expect(row.checkpoint).toBe(CHANGE_INSTRUCTION_CHECKPOINT);
    expect(row.decision).toBe('proceed');
    expect(row.refId).toBe(SCOPE.refId);
  });

  it('con dudas no gasta sin confirmación expresa, y con ella sí', async () => {
    await withKey();
    fetchMock.mockImplementation(async () => jevResponse(3, 0.75, 'none'));

    await expect(changeWithGate('cambia el suelo')).rejects.toThrow(/Entiendo las dudas/);
    expect(imageAdapter).not.toHaveBeenCalled();

    await expect(changeWithGate('cambia el suelo', true)).resolves.toBeDefined();
    expect(imageAdapter).toHaveBeenCalledTimes(1);
  });

  it('con fiabilidad baja pide reformular y no llama a la IA ni con confirmación', async () => {
    await withKey();
    fetchMock.mockImplementation(async () => jevResponse(1, 0.05, 'not_a_request'));

    await expect(changeWithGate('hazlo mejor', true)).rejects.toThrow(/reformules/);
    expect(imageAdapter).not.toHaveBeenCalled();
    const row = await prisma.aiQualityEvaluation.findFirstOrThrow();
    expect(row.decision).toBe('block');
  });

  it('si Jev se cae falla en cerrado: exige confirmación, nunca sigue solo', async () => {
    await withKey();
    fetchMock.mockImplementation(async () => new Response('boom', { status: 500 }));

    await expect(changeWithGate('suelo de madera clara en el salón')).rejects.toThrow(
      /deja dudas/,
    );
    expect(imageAdapter).not.toHaveBeenCalled();

    await expect(changeWithGate('suelo de madera clara en el salón', true)).resolves.toBeDefined();
    const rows = await prisma.aiQualityEvaluation.findMany();
    expect(rows.every((row) => row.failOpen === false)).toBe(true);
  });

  it('la misma instrucción no se vuelve a pagar a Jev', async () => {
    await withKey();
    fetchMock.mockImplementation(async () => jevResponse(4, 0.98, 'none'));

    await changeWithGate('suelo de madera clara en el salón');
    await changeWithGate('suelo de madera clara en el salón');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('cambiar la selección reevalúa el mismo texto; volver a la misma zona reutiliza su evaluación', async () => {
    await withKey();
    fetchMock.mockImplementation(async () => jevResponse(4, .98, 'none'));
    const instruction = 'En esta area marcada falta una puerta';
    const first = { id: 'one', bbox: { x: .1, y: .2, width: .2, height: .2 } };
    const second = { id: 'two', bbox: { ...first.bbox, x: .5 } };
    await instructionQuality(CTX, SCOPE, 'render3d', instruction);
    await instructionQuality(CTX, { ...SCOPE, imageZone: first }, 'render3d', instruction);
    await instructionQuality(CTX, { ...SCOPE, imageZone: second }, 'render3d', instruction);
    await instructionQuality(CTX, { ...SCOPE, imageZone: { ...second, id: 'same-location' } }, 'render3d', instruction);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const sent = fetchMock.mock.calls.map(([, request]) => JSON.parse(JSON.parse(request.body).state));
    expect(sent[0].imageSelection).toBeUndefined();
    expect(sent[1]).toMatchObject({ userInstruction: instruction, imageSelection: { scope: 'region', bounds: first.bbox } });
    expect(sent[2].imageSelection.bounds).toEqual(second.bbox);
  });
});

describe('prompt libre del editor', () => {
  it('no reutiliza un rechazo de edición al generar; reevalúa si cambian los permisos del estudio', async () => {
    await withKey();
    const instruction = 'Conserva las puertas y deja libres las zonas de paso, con materiales realistas.';
    fetchMock.mockImplementationOnce(async () => jevResponse(1, .3, 'not_a_request'));
    await expect(instructionQuality(CTX, SCOPE, 'render3d', instruction)).resolves.toMatchObject({ decision: 'block' });

    const options = defaultRenderDesignOptions();
    const context = buildEditorInstructionContext(emptyEditorDocument(), 'moderno', '', options);
    fetchMock.mockImplementation(async () => jevResponse(3, .98, 'none'));
    const scope = { ...SCOPE, generationContext: context };
    await expect(assertFreePromptQuality(CTX, scope, instruction)).resolves.toMatchObject({ decision: 'proceed' });
    await assertFreePromptQuality(CTX, scope, instruction);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await assertFreePromptQuality(CTX, { ...scope,
      generationContext: buildEditorInstructionContext(emptyEditorDocument(), 'moderno', '', { ...options, freedom: 'free' }),
    }, instruction);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const sent = JSON.parse(fetchMock.mock.calls[1]![1].body);
    expect(JSON.parse(sent.state)).toMatchObject({ purpose: 'generate-design', generationContext: JSON.parse(JSON.stringify(context)) });
    expect(JSON.stringify(sent.questions)).toContain('preservation rules');
    const rows = await prisma.aiQualityEvaluation.findMany({ orderBy: { createdAt: 'asc' } });
    expect(rows.map(row => row.decision)).toEqual(['block', 'proceed', 'proceed', 'proceed']);
    expect(Number(rows[2]!.costUsd)).toBe(0);
  });

  it('con dudas sigue (la confirmación la pide la puerta del plano) y con bloqueo corta', async () => {
    await withKey();
    fetchMock.mockImplementation(async () => jevResponse(3, 0.75, 'none'));
    await expect(
      assertFreePromptQuality(CTX, SCOPE, 'más cálido'),
    ).resolves.toMatchObject({ decision: 'confirm' });

    fetchMock.mockImplementation(async () => jevResponse(1, 0.05, 'impossible'));
    await expect(
      assertFreePromptQuality(CTX, SCOPE, 'pon el sofá flotando fuera de la casa'),
    ).rejects.toThrow(/reformules/);
  });

  it('sin instrucción libre no se evalúa nada', async () => {
    await expect(assertFreePromptQuality(CTX, SCOPE, '   ')).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
