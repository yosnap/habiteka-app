/**
 * Los respaldos `flux-2/*` de KIE rechazan prompts de más de 5000 caracteres
 * (`kie_prompt_too_long`). El prompt compacto de una vista interior llevaba la
 * planta entera y se iba por encima de 7000 con un plano real, así que ninguna
 * estancia llegaba a renderizarse por respaldo. Aquí se garantiza el tope con
 * el plano real de una vivienda y con una planta grande sintética.
 */
import { describe, expect, it } from 'vitest';
import { emptyEditorDocument, type EditorDocument } from '@/lib/editor-document/schema';
import { parseEditorDocument } from '@/lib/editor-document/validation';
import { setDesignSpaceKind } from '@/lib/editor-document/spatial-properties';
import { renderViewSchema, type RenderView } from '@/lib/editor-document/render-view';
import { roomInteriorCameras } from '@/lib/editor-document/room-interior-cameras';
import { defaultRenderDesignOptions } from '@/lib/editor-document/render-design-options';
import {
  INTERIOR_EYE_LEVEL_RULE,
  selectedViewPrompt,
} from '@/server/agent/editor-v2/selected-view-prompt';
import { COMPACT_RENDER_POLICY } from '@/server/agent/editor-v2/compact-render-context';
import {
  COMPACT_PROMPT_LIMIT,
  roomWallIds,
  scopedRoomIds,
} from '@/server/agent/editor-v2/interior-prompt-scope';
import raw from '../editor-document/fixtures/plano-vivienda-real.json';

const realPlan = setDesignSpaceKind(parseEditorDocument(raw), 'interior');

/** Planta sintética grande: rejilla de estancias, que es el peor caso de contexto. */
function gridPlan(columns: number, rows: number): EditorDocument {
  const doc = emptyEditorDocument();
  const vertexId = (i: number, j: number) => `v-${i}-${j}`;
  for (let i = 0; i <= columns; i++)
    for (let j = 0; j <= rows; j++)
      doc.vertices.push({ id: vertexId(i, j), x: i * 4200, y: j * 3600 });
  const wall = (id: string, from: string, to: string) =>
    doc.walls.push({
      id,
      name: `Muro ${id}`,
      startVertexId: from,
      endVertexId: to,
      thicknessMm: 120,
      dimensionalOrigin: 'physical' as const,
    });
  for (let i = 0; i <= columns; i++)
    for (let j = 0; j < rows; j++) wall(`wv-${i}-${j}`, vertexId(i, j), vertexId(i, j + 1));
  for (let j = 0; j <= rows; j++)
    for (let i = 0; i < columns; i++) wall(`wh-${i}-${j}`, vertexId(i, j), vertexId(i + 1, j));
  return setDesignSpaceKind(doc, 'interior');
}

function interiorPrompts(doc: EditorDocument): { name: string; prompt: string }[] {
  const cameras = roomInteriorCameras(doc);
  const options = {
    ...defaultRenderDesignOptions(),
    freedom: 'free' as const,
    interiorRoomIds: cameras.map((camera) => camera.roomId).slice(0, 12),
  };
  return cameras.slice(0, 12).map((camera) => {
    const view: RenderView = renderViewSchema.parse({
      ...camera.camera,
      preset: 'custom',
      quaternion: [0, 0, 0, 1],
      fov: camera.camera.fovDeg,
      aspect: 1.5,
      allLevels: false,
      cutaway: false,
      lighting: 'daylight',
    });
    return {
      name: camera.name,
      prompt: selectedViewPrompt(doc, view, 'moderno', 'Objetivo', 'Instrucción', options, true),
    };
  });
}

describe('longitud del prompt compacto en vistas interiores', () => {
  it('cabe en el tope de FLUX con el plano real de una vivienda', () => {
    const prompts = interiorPrompts(realPlan);
    expect(prompts.length).toBeGreaterThanOrEqual(6);
    for (const { name, prompt } of prompts)
      expect(prompt.length, `${name} => ${prompt.length}`).toBeLessThanOrEqual(
        COMPACT_PROMPT_LIMIT,
      );
  });

  it('cabe también en una planta grande sintética', () => {
    const prompts = interiorPrompts(gridPlan(5, 4));
    expect(prompts.length).toBe(12);
    for (const { name, prompt } of prompts)
      expect(prompt.length, `${name} => ${prompt.length}`).toBeLessThanOrEqual(
        COMPACT_PROMPT_LIMIT,
      );
  });

  it('conserva las restricciones duras y el JSON entero al recortar', () => {
    for (const { prompt } of interiorPrompts(realPlan)) {
      expect(prompt.startsWith(COMPACT_RENDER_POLICY)).toBe(true);
      expect(prompt).toContain(INTERIOR_EYE_LEVEL_RULE);
      expect(prompt).toContain('AMUEBLAMIENTO:');
      const context: unknown = JSON.parse(prompt.split('\n').at(-1)!);
      expect(context).toHaveProperty('schemas');
      expect(context).toHaveProperty('values');
    }
  });

  it('acota el contexto a la estancia de la cámara y sus vecinas', () => {
    const cameras = roomInteriorCameras(realPlan);
    const rooms = cameras.map((camera) => ({ id: camera.roomId, areaM2: 0, boundaryM: [] }));
    const target = cameras[0]!.roomId;
    const scoped = scopedRoomIds(rooms, target);
    expect(scoped).toContain(target);
    expect(scoped.length).toBeLessThan(rooms.length);
    const walls = new Set(roomWallIds(target));
    for (const id of scoped)
      if (id !== target) expect(roomWallIds(id).some((wall) => walls.has(wall))).toBe(true);
  });
});
