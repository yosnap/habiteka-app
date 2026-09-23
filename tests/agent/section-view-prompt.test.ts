import { describe, expect, it } from 'vitest';
import { parseEditorDocument } from '@/lib/editor-document/validation';
import { setDesignSpaceKind } from '@/lib/editor-document/spatial-properties';
import { renderViewSchema } from '@/lib/editor-document/render-view';
import { defaultRenderDesignOptions } from '@/lib/editor-document/render-design-options';
import { roomInteriorCameras } from '@/lib/editor-document/room-interior-cameras';
import { SECTION_VIEW_RULE, SECTION_VIEW_RULE_COMPACT, selectedViewPrompt } from '@/server/agent/editor-v2/selected-view-prompt';
import { COMPACT_PROMPT_LIMIT } from '@/server/agent/editor-v2/interior-prompt-scope';
import raw from '../editor-document/fixtures/plano-vivienda-real.json';

const plan = setDesignSpaceKind(parseEditorDocument(raw), 'interior');
const view = (preset: string, cutawayWallIds: string[] = []) => renderViewSchema.parse({
  preset, position: [20, 1.5, 5], quaternion: [0, 0, 0, 1], fov: 45, aspect: 1.5,
  allLevels: false, cutaway: cutawayWallIds.length > 0, lighting: 'daylight', cutawayWallIds,
});
const options = { ...defaultRenderDesignOptions(), freedom: 'free' as const };

describe('vistas desde fuera del edificio', () => {
  it('un alzado se trata como maqueta seccionada, también en el prompt compacto y sin pasarse del tope', () => {
    const full = selectedViewPrompt(plan, view('right'), 'moderno', '', '', options);
    const compact = selectedViewPrompt(plan, view('right'), 'moderno', '', '', options, true);
    expect(full).toContain(SECTION_VIEW_RULE);
    expect(compact).toContain(SECTION_VIEW_RULE_COMPACT);
    expect(compact.length).toBeLessThanOrEqual(COMPACT_PROMPT_LIMIT);
  });
  it('una cámara libre solo lo es si mira a través de muros recortados', () => {
    expect(selectedViewPrompt(plan, view('custom'), 'moderno', '', '', options)).not.toContain(SECTION_VIEW_RULE);
    expect(selectedViewPrompt(plan, view('custom', [plan.walls[0]!.id]), 'moderno', '', '', options)).toContain(SECTION_VIEW_RULE);
  });
  it('la vista interior por estancia no lleva la regla de maqueta', () => {
    const camera = roomInteriorCameras(plan)[0]!;
    const interior = { ...options, interiorRoomIds: [camera.roomId] };
    const eye = renderViewSchema.parse({ ...camera.camera, preset: 'custom', quaternion: [0, 0, 0, 1], fov: camera.camera.fovDeg,
      aspect: 1.5, allLevels: false, cutaway: false, lighting: 'daylight' });
    expect(selectedViewPrompt(plan, eye, 'moderno', '', '', interior)).not.toContain(SECTION_VIEW_RULE);
  });
});
