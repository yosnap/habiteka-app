/**
 * El tope del prompt compacto es el riesgo dominante de la iluminación: cada
 * foco, cada tira y cada escena paga caracteres sobre un presupuesto que ya
 * estaba justo. Aquí se mide con el plano real de una vivienda iluminada a
 * fondo, en vista interior (donde se acota a la estancia de la cámara) y en
 * vista exterior (donde no hay estancia a la que acotar).
 */
import { describe, expect, it } from 'vitest';
import { renderViewSchema, type RenderView } from '@/lib/editor-document/render-view';
import { roomInteriorCameras } from '@/lib/editor-document/room-interior-cameras';
import { defaultRenderDesignOptions } from '@/lib/editor-document/render-design-options';
import { selectedViewPrompt } from '@/server/agent/editor-v2/selected-view-prompt';
import { COMPACT_RENDER_POLICY } from '@/server/agent/editor-v2/compact-render-context';
import { COMPACT_PROMPT_LIMIT } from '@/server/agent/editor-v2/interior-prompt-scope';
import { CEILING_RENDER_POLICY_COMPACT } from '@/lib/editor-document/ceiling-design-context';
import { ceilingSurfaces } from '@/lib/editor-document/ceiling-geometry';
import type { EditorDocument } from '@/lib/editor-document/schema';
import { litPlan } from './lighting-prompt-fixtures';

function interiorPrompts(doc: EditorDocument) {
  const cameras = roomInteriorCameras(doc);
  const options = {
    ...defaultRenderDesignOptions(),
    freedom: 'free' as const,
    interiorRoomIds: cameras.map((camera) => camera.roomId),
  };
  return cameras.map((camera) => {
    const view: RenderView = renderViewSchema.parse({
      ...camera.camera, preset: 'custom', quaternion: [0, 0, 0, 1], fov: camera.camera.fovDeg,
      aspect: 1.5, allLevels: false, cutaway: false, lighting: 'daylight',
    });
    return { name: camera.name, prompt: selectedViewPrompt(doc, view, 'moderno', 'Objetivo', 'Instrucción', options, true) };
  });
}

function exteriorPrompt(doc: EditorDocument) {
  const view: RenderView = renderViewSchema.parse({
    preset: 'isometric', position: [12, 12, 12], quaternion: [0, 0, 0, 1], fov: 45,
    aspect: 1.5, allLevels: false, cutaway: true, lighting: 'daylight',
  });
  return selectedViewPrompt(doc, view, 'moderno', 'Objetivo', 'Instrucción', undefined, true);
}

describe('prompt compacto de un plano iluminado a fondo', () => {
  it('lleva focos, foseado, tira de cocina y escena activa en el plano de prueba', () => {
    const doc = litPlan({ freeStrips: true });
    expect(doc.luminaires?.some((light) => light.kind === 'spot')).toBe(true);
    expect(doc.lightStrips?.some((strip) => strip.kind === 'cove')).toBe(true);
    expect(doc.lightStrips?.some((strip) => !strip.derived)).toBe(true);
    expect(doc.lightingScenes?.some((scene) => scene.active)).toBe(true);
    expect(ceilingSurfaces(doc).length).toBeGreaterThanOrEqual(6);
  });

  it.each([false, true])('cabe en el tope en vista interior y exterior (tiras libres: %s)', (freeStrips) => {
    const doc = litPlan({ freeStrips });
    const prompts = interiorPrompts(doc);
    expect(prompts.length).toBeGreaterThanOrEqual(6);
    for (const { name, prompt } of prompts)
      expect(prompt.length, `${name} => ${prompt.length}`).toBeLessThanOrEqual(COMPACT_PROMPT_LIMIT);
    const exterior = exteriorPrompt(doc);
    expect(exterior.length, `exterior => ${exterior.length}`).toBeLessThanOrEqual(COMPACT_PROMPT_LIMIT);
  });

  it('nunca recorta la política ni parte el JSON, por mucho que degrade', () => {
    const doc = litPlan({ freeStrips: true });
    for (const { prompt } of [...interiorPrompts(doc), { prompt: exteriorPrompt(doc) }]) {
      expect(prompt.startsWith(COMPACT_RENDER_POLICY)).toBe(true);
      expect(prompt).toContain('lightStrips: tiras LED lineales');
      const context: unknown = JSON.parse(prompt.split('\n').at(-1)!);
      expect(context).toHaveProperty('schemas');
      expect(context).toHaveProperty('values');
    }
  });

  it('mantiene la política compacta dentro de su presupuesto de caracteres', () => {
    expect(CEILING_RENDER_POLICY_COMPACT.length).toBeLessThan(660);
  });
});
