import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ quality: vi.fn(), image: vi.fn(), vision: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/server/auth/require-org-context', () => ({ requireOrgContext: async () => ({ organizationId: 'org', userId: 'user' }) }));
vi.mock('@/server/db/scoped-repo', () => ({ withOrg: () => ({ projects: { findById: async () => ({ id: 'project' }) }, zones: { list: async () => [] } }) }));
vi.mock('@/server/privacy/consent-service', () => ({ assertConsent: vi.fn() }));
vi.mock('@/server/legal/tos-acceptance-service', () => ({ assertTosAccepted: vi.fn() }));
vi.mock('@/server/agent/editor-v2/verified-editor-document', () => ({ verifiedEditorDocument: async (_ctx: unknown, _scope: unknown, doc: unknown) => doc }));
vi.mock('@/server/quality/editor-gate', () => ({ assertEditorQuality: vi.fn() }));
vi.mock('@/server/quality/evaluate', () => ({ evaluateCheckpointCached: mocks.quality }));
vi.mock('@/server/ai', () => ({ getImageAdapterForAction: mocks.image, getChatVisionAdapter: mocks.vision }));

import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { setDesignSpaceKind } from '@/lib/editor-document/spatial-properties';
import { defaultRenderDesignOptions } from '@/lib/editor-document/render-design-options';
import type { RenderCapture } from '@/lib/editor-document/render-view';
import {
  generateConceptRenderFromEditor, generateDesignFromEditor, proposeNativeDesignFromEditor,
} from '@/app/(app)/projects/[id]/_actions/agent-actions';

const instruction = 'Materiales realistas, pasos despejados y puertas en sus posiciones del plano.';
const doc = setDesignSpaceKind(addWallPath(emptyEditorDocument(), [
  { x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 },
], true), 'casa');
doc.labels = [{ id: 'dining', text: 'Comedor', x: 2000, y: 1500 }];
const options = { ...defaultRenderDesignOptions(), freedom: 'free' as const, lighting: 'warm' as const };
const capture: RenderCapture = { dataUrl: 'data:image/png;base64,unused', view: {
  preset: 'top', position: [0, 10, 0], focus: [0, 0, 0], quaternion: [0, 0, 0, 1],
  fov: 45, aspect: 1, allLevels: false, cutaway: false, lighting: 'warm',
  roomName: 'Nombre no verificado del cliente', roomId: 'no-verificado',
} };

beforeEach(() => {
  vi.clearAllMocks();
  // Se detiene tras la evaluación para comprobar qué recibe sin resolver modelos ni gastar.
  mocks.quality.mockResolvedValue({ score: 30, decision: 'block', reasons: ['Motivo de prueba'], failOpen: true });
});

describe('contexto que envía el estudio a la evaluación de instrucciones', () => {
  it('incluye opciones y cámara validadas al generar una imagen, sin etiquetas de cliente', async () => {
    const result = await generateConceptRenderFromEditor('project', doc, 'moderno', 'Ambiente claro', instruction, null, capture, { options });
    expect(result).toMatchObject({ actionError: expect.stringContaining('La generación no ha comenzado') });
    const evidence = mocks.quality.mock.calls[0]![2];
    expect(evidence).toMatchObject({ purpose: 'generate-design', userInstruction: instruction, generationContext: {
      objective: 'Ambiente claro', lighting: 'warm', decoration: { freedom: 'free' }, scope: { kind: 'all', view: 'top' },
    } });
    expect(evidence.generationContext.scope.levels[0].selectedRoomNames).toEqual(['Comedor']);
    expect(JSON.stringify(evidence)).not.toContain('no-verificado');
    expect(JSON.stringify(evidence)).not.toContain('Nombre no verificado');
    expect(mocks.image).not.toHaveBeenCalled();
    expect(mocks.vision).not.toHaveBeenCalled();
  });

  it('una propuesta editable aporta sus permisos y su objetivo con el tipo correcto', async () => {
    await proposeNativeDesignFromEditor('project', doc, 'moderno', 'casa', 'Ambiente claro', instruction, null, options);
    expect(mocks.quality.mock.calls[0]![2]).toMatchObject({ purpose: 'generate-design', deliverableType: 'propuesta',
      generationContext: { objective: 'Ambiente claro', decoration: { freedom: 'free' } } });
    expect(mocks.vision).not.toHaveBeenCalled();
  });

  it('el acceso directo desde el editor también evalúa indicaciones de creación con contexto', async () => {
    await expect(generateDesignFromEditor('project', doc, 'moderno', 'render3d', 'casa', '', instruction)).rejects.toThrow(/reformules/);
    expect(mocks.quality.mock.calls[0]![2]).toMatchObject({ purpose: 'generate-design', generationContext: {
      style: 'moderno', documentRevision: doc.revision, spaceKind: 'casa',
    } });
  });

  it('una captura ausente se rechaza antes de evaluar el texto', async () => {
    const result = await generateConceptRenderFromEditor('project', doc, 'moderno', '', instruction);
    expect(result).toMatchObject({ actionError: expect.stringContaining('prepara primero la captura') });
    expect(mocks.quality).not.toHaveBeenCalled();
  });
});
