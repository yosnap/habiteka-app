/**
 * Puerta de calidad previa a cualquier generación de pago desde el editor.
 *
 * Lo que se comprueba es exactamente lo que cuesta dinero: con fiabilidad alta
 * se genera; con dudas hace falta confirmación expresa del usuario; con
 * fiabilidad baja no se llega a llamar al modelo de imagen; y si Jev no
 * responde se falla en cerrado (confirmar, nunca seguir solo). La evidencia de
 * un documento que no ha cambiado se reutiliza en vez de volver a pagarla.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
// `evaluate` y el resolutor de claves importan 'server-only'; en Vitest no hay Server Components.
vi.mock('server-only', () => ({}));
import { addOpening, addWallPath } from '@/canvas/editor-v2/editing-operations';
import { emptyEditorDocument, type EditorDocument } from '@/lib/editor-document/schema';
import { editorGeometryFingerprint } from '@/server/quality/editor-geometry-fingerprint';
import { assertEditorQuality, EDITOR_STRUCTURE_CHECKPOINT } from '@/server/quality/editor-gate';
import { QUALITY_THRESHOLDS_KEY } from '@/server/quality/evaluate';
import { prisma } from '@/server/db/prisma';
import { sealSecret } from '@/server/security/secret-box';
import { resetDb } from '../helpers/db';

const CTX = { organizationId: 'org-editor-gate', userId: 'user-editor-gate' };
const SCOPE = { projectId: 'proyecto-1', zoneId: null };

function plan(): EditorDocument {
  const room = addWallPath(
    emptyEditorDocument(),
    [
      { x: 0, y: 0 },
      { x: 4000, y: 0 },
      { x: 4000, y: 3000 },
      { x: 0, y: 3000 },
    ],
    true,
  );
  return addOpening(room, room.walls[0]!.id, { x: 2000, y: 0 }, 'puerta');
}

/** Respuesta de Jev con el mismo valor en todas las preguntas del punto de control. */
function jevResponse(score: number, noul: number, choice: string): Response {
  return new Response(
    JSON.stringify({
      model: 'jev-latest',
      answers: {
        geometry_sound: { type: 'score', score, confidence: 0.8 },
        rooms_closed: { type: 'noul', noul },
        openings_anchored: { type: 'noul', noul },
        scale_known: { type: 'noul', noul },
        levels_coherent: { type: 'noul', noul },
        main_issue: { type: 'choice', choice },
      },
      usage: { input_tokens: 1500 },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

const fetchMock = vi.fn();

/** Doble del adaptador de imagen: cuenta las generaciones que se habrían cobrado. */
const imageAdapter = vi.fn(async () => ({ assetUrl: 'https://example.test/render.png' }));

/** Misma secuencia que las acciones: primero la puerta, después el gasto. */
async function generateWithGate(document: EditorDocument, ack = false) {
  await assertEditorQuality(CTX, SCOPE, document, ack);
  return imageAdapter();
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

describe('assertEditorQuality', () => {
  it('mantiene bloqueada una importación contradictoria hasta cambiar su geometría', async () => {
    await withKey();
    fetchMock.mockImplementation(async () => jevResponse(5, 0.98, 'none'));
    const source = plan();
    const flagged: EditorDocument = {
      ...source,
      importReview: {
        geometryFingerprint: editorGeometryFingerprint(source),
        reasons: ['Las estancias del origen se solapan.'],
      },
    };
    await expect(generateWithGate(flagged, true)).rejects.toThrow(/se solapan/);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(imageAdapter).not.toHaveBeenCalled();

    const corrected: EditorDocument = {
      ...flagged,
      vertices: flagged.vertices.map((vertex) => ({ ...vertex, x: vertex.x === 4000 ? 4200 : vertex.x })),
    };
    await expect(generateWithGate(corrected)).rejects.toThrow(/Entiendo las dudas/);
    await expect(generateWithGate(corrected, true)).resolves.toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('bloquea un boceto sin escala confirmada aunque Jev diera una nota alta y el usuario aceptase', async () => {
    await withKey();
    fetchMock.mockImplementation(async () => jevResponse(5, 0.98, 'none'));
    const source = plan();
    const unscaled = {
      ...source,
      walls: source.walls.map((wall) => ({ ...wall, dimensionalOrigin: 'raster' as const })),
    };
    await expect(generateWithGate(unscaled, true)).rejects.toThrow(/escala física/);
    expect(imageAdapter).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('con fiabilidad alta genera sin fricción y registra la evaluación', async () => {
    await withKey();
    fetchMock.mockImplementation(async () => jevResponse(5, 0.98, 'none'));

    await expect(generateWithGate(plan())).resolves.toMatchObject({ assetUrl: expect.any(String) });
    expect(imageAdapter).toHaveBeenCalledTimes(1);

    const row = await prisma.aiQualityEvaluation.findFirstOrThrow();
    expect(row.checkpoint).toBe(EDITOR_STRUCTURE_CHECKPOINT);
    expect(row.decision).toBe('proceed');
    expect(row.projectId).toBe(SCOPE.projectId);
    expect(Number(row.costUsd)).toBeGreaterThan(0);
  });

  it('con dudas y sin confirmación no se genera, y con confirmación sí', async () => {
    await withKey();
    fetchMock.mockImplementation(async () => jevResponse(4, 0.55, 'openings'));

    await expect(generateWithGate(plan())).rejects.toThrow(/Entiendo las dudas/);
    expect(imageAdapter).not.toHaveBeenCalled();

    await expect(generateWithGate(plan(), true)).resolves.toBeDefined();
    expect(imageAdapter).toHaveBeenCalledTimes(1);
  });

  it('con fiabilidad baja no se llama al modelo de imagen ni con confirmación', async () => {
    await withKey();
    fetchMock.mockImplementation(async () => jevResponse(1, 0.05, 'walls'));

    await expect(generateWithGate(plan(), true)).rejects.toThrow(/no está en condiciones/);
    expect(imageAdapter).not.toHaveBeenCalled();
    const row = await prisma.aiQualityEvaluation.findFirstOrThrow();
    expect(row.decision).toBe('block');
  });

  it('si Jev se cae falla en cerrado: exige confirmación, nunca sigue solo', async () => {
    await withKey();
    fetchMock.mockImplementation(async () => new Response('boom', { status: 500 }));

    await expect(generateWithGate(plan())).rejects.toThrow(/dudas sobre el plano/);
    expect(imageAdapter).not.toHaveBeenCalled();

    await expect(generateWithGate(plan(), true)).resolves.toBeDefined();
    const rows = await prisma.aiQualityEvaluation.findMany();
    expect(rows.every((row) => row.failOpen === false)).toBe(true);
  });

  it('un documento sin cambios reutiliza la evaluación y no vuelve a pagar a Jev', async () => {
    await withKey();
    fetchMock.mockImplementation(async () => jevResponse(5, 0.98, 'none'));

    await generateWithGate(plan());
    await generateWithGate(plan());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Dos pasos de puerta, una sola llamada pagada: la reutilización se registra
    // con coste 0 y su marca, para que ningún paso quede sin rastro.
    const rows = await prisma.aiQualityEvaluation.findMany({ orderBy: { createdAt: 'asc' } });
    expect(rows).toHaveLength(2);
    expect(Number(rows[1]!.costUsd)).toBe(0);
    expect(rows[1]!.answers).toMatchObject({
      _gate: { gate: 'passed', action: 'generacion_editor', reused: true },
    });
    expect(rows[0]!.answers).toMatchObject({ _gate: { gate: 'passed' } });
  });

  it('un documento distinto se vuelve a evaluar', async () => {
    await withKey();
    fetchMock.mockImplementation(async () => jevResponse(5, 0.98, 'none'));

    await generateWithGate(plan());
    const changed = addWallPath(plan(), [
      { x: 0, y: 3000 },
      { x: 0, y: 6000 },
    ]);
    await generateWithGate(changed);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
