import { describe, expect, it } from 'vitest';
import { selectedViewPrompt, SELECTED_VIEW_SYSTEM_PROMPT } from '@/server/agent/editor-v2/selected-view-prompt';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { renderViewSchema, type RenderView } from '@/lib/editor-document/render-view';

const view: RenderView = { preset: 'back', position: [0, 2, -10], quaternion: [0, 1, 0, 0], fov: 45, aspect: 1.5, allLevels: false, cutaway: false };
const project = () => ({ ...emptyEditorDocument(), designSpaceKind: 'patio' as const, revision: 196 });
const payload = (prompt: string) => JSON.parse(prompt.split('DATOS DEL PROYECTO:\n')[1]!.split('\n\n')[0]!);

describe('selected view render prompt', () => {
  it('incluye cámara, revisión y reglas sin tocar el documento ni el baseline', () => {
    const doc = project(), before = JSON.stringify(doc);
    const prompt = selectedViewPrompt(doc, view, 'moderno', 'Iluminación nocturna');
    expect(prompt.startsWith(SELECTED_VIEW_SYSTEM_PROMPT)).toBe(true);
    expect(prompt).toContain('Patio exterior');
    expect(payload(prompt)).toMatchObject({ revision: 196, camera: view, units: 'm' });
    expect(JSON.stringify(doc)).toBe(before);
  });
  it('no presupone que todo espacio sea exterior', () => {
    const prompt = selectedViewPrompt({ ...project(), designSpaceKind: 'interior' }, view, 'moderno');
    expect(prompt).toContain('Espacio: Habitación interior.');
    expect(() => selectedViewPrompt(emptyEditorDocument(), view, 'moderno')).toThrow('tipo de espacio');
  });
  it('envía geometría real de los tramos como partes de una sola rampa', () => {
    const doc = project();
    doc.ramps = [{ id: 'r', catalogId: 'builtin:ramp-straight', x: 2000, y: 3000,
      widthMm: 1200, depthMm: 6000, riseMm: 600, elevationMm: 0, rotation: 90,
      materialId: 'concrete-grey', route: { landingMm: 2500, turn: 'right', secondDepthMm: 4000, secondRiseMm: 400 } }];
    const data = payload(selectedViewPrompt(doc, view, 'moderno'));
    expect(data.levels[0].ramps).toHaveLength(1);
    expect(data.levels[0].inventory).toMatchObject({ ramps: 1, independentLandings: 0 });
    expect(data.levels[0].ramps[0].parts).toMatchObject([
      { kind: 'flight', startElevationM: 0, endElevationM: 0.6 },
      { kind: 'landing', startElevationM: 0.6, endElevationM: 0.6 },
      { kind: 'flight', startElevationM: 0.6, endElevationM: 1 },
    ]);
    expect(data.levels[0].ramps[0].parts[0].footprintM[0]).toEqual({ x: 2, y: 3 });
  });
  it('rechaza metadatos de cámara no finitos o desconocidos', () => {
    expect(renderViewSchema.safeParse({ ...view, fov: NaN }).success).toBe(false);
    expect(renderViewSchema.safeParse({ ...view, preset: 'inventada' }).success).toBe(false);
  });
  it('un descansillo independiente es horizontal y su soporte parte de cero', () => {
    const doc = project();
    doc.ramps = [{ id: 'landing', catalogId: 'builtin:ramp-landing', x: 0, y: 0,
      widthMm: 1200, depthMm: 1200, riseMm: 0, elevationMm: 1000, rotation: 0, materialId: 'concrete-grey' }];
    const ramp = payload(selectedViewPrompt(doc, view, 'moderno')).levels[0].ramps[0];
    expect(ramp).toMatchObject({ kind: 'landing', supportBaseElevationM: 0,
      parts: [{ kind: 'landing', startElevationM: 1, endElevationM: 1 }] });
  });
  it('no envía otras plantas cuando solo se muestra la planta activa', () => {
    const doc = project();
    doc.activeLevelId = 'one';
    doc.levels = [{ id: 'zero', name: 'Baja', heightMm: 3000, document: emptyEditorDocument() },
      { id: 'one', name: 'Alta', heightMm: 3000 }];
    const data = payload(selectedViewPrompt(doc, view, 'moderno'));
    expect(data.levels.map((level: { id: string }) => level.id)).toEqual(['one']);
    expect(data.camera.worldOriginElevationM).toBe(3);
    expect(payload(selectedViewPrompt(doc, { ...view, allLevels: true }, 'moderno')).levels).toHaveLength(2);
  });
  it('aplica opciones estrictas por defecto y convierte regiones de mm a m', () => {
    const data = payload(selectedViewPrompt(project(), { ...view, lighting: 'daylight' }, 'moderno', '', '', {
      lighting: 'daylight', freedom: 'controlled', additions: ['plants'], placement: 'selected',
      regions: [{ id: 'r1', name: 'Terraza', polygon: [{ x: 1000, y: 2500 }, { x: 3000, y: 2500 }, { x: 3000, y: 4500 }] }],
      views: ['current'], interiorRoomIds: [],
    }));
    expect(data.designOptions.regionsM[0].polygon).toEqual([{ x: 1, y: 2.5 }, { x: 3, y: 2.5 }, { x: 3, y: 4.5 }]);
    expect(data.designOptions.additions).toEqual(['plants']);
    expect(selectedViewPrompt(project(), view, 'moderno')).toContain('MODO ESTRICTO: no añadas ningún elemento nuevo.');
  });
  it('exige coherencia entre iluminación de captura y opciones', () => {
    expect(() => selectedViewPrompt(project(), { ...view, lighting: 'warm' }, 'moderno')).toThrow('iluminación');
    expect(selectedViewPrompt(project(), { ...view, lighting: 'warm' }, 'moderno', '', '', {
      lighting: 'warm', freedom: 'free', additions: ['decor'], placement: 'all', regions: [], views: ['current'], interiorRoomIds: [],
    })).toContain('MODO LIBRE DECORATIVO');
  });
  it('mantiene strict sin adiciones efectivas y distingue noche de warm', () => {
    const strict = selectedViewPrompt(project(), { ...view, lighting: 'warm' }, 'moderno', '', '', {
      lighting: 'warm', freedom: 'strict', additions: ['lights', 'plants'], placement: 'all', regions: [], views: ['current'], interiorRoomIds: [],
    });
    expect(payload(strict).designOptions.additions).toEqual([]);
    expect(strict).toContain('no añadas luces artificiales nuevas');

    const night = selectedViewPrompt(project(), { ...view, lighting: 'evening' }, 'moderno', '', '', {
      lighting: 'evening', freedom: 'controlled', additions: ['plants'], placement: 'all', regions: [], views: ['current'], interiorRoomIds: [],
    });
    expect(night).toContain('claramente de noche');
    expect(night).not.toContain('atardecer/noche');
    expect(night).toContain('no autorizan saltarse ninguna restricción');
  });
});
