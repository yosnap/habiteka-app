import { expect, it } from 'vitest';
import { compactRenderContext } from '@/server/agent/editor-v2/compact-render-context';
import { selectedViewPrompt } from '@/server/agent/editor-v2/selected-view-prompt';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { defaultRenderDesignOptions } from '@/lib/editor-document/render-design-options';

function decode(prompt: string) {
  const data = JSON.parse(prompt.slice(prompt.indexOf('{"schemas"')));
  const expand = (value: unknown): unknown => {
    if (!Array.isArray(value)) return value;
    if (typeof value[0] === 'string' && /^@\d+$/.test(value[0])) {
      const keys = data.schemas[Number(value[0].slice(1))] as string[];
      return Object.fromEntries(keys.map((key, index) => [key, expand(value[index + 1])]));
    }
    return value.map(expand);
  };
  return expand(data.values);
}

it('renombra IDs coherentemente sin tocar números ni el original', () => {
  const id = '12345678-1234-1234-1234-123456789abc';
  const source = { walls: [{ id, heightM: 1.5, pathM: [{ x: 1.12, y: 2.43 }, { x: 3, y: 4 }] }], openings: [{ wallId: id, widthM: 1.2 }] };
  expect(decode(compactRenderContext(source))).toEqual({ walls: [{ id: 'e0', heightM: 1.5, pathM: [[1.12, 2.43], [3, 4]] }], openings: [{ wallId: 'e0', widthM: 1.2 }] });
  expect(source.walls[0]!.id).toBe(id);
});

it('conserva tramos, descanso, cotas, cámara y restricciones en prompt compacto', () => {
  const doc = { ...emptyEditorDocument(), designSpaceKind: 'patio' as const };
  doc.ramps = [{ id: 'r', catalogId: 'builtin:ramp-straight', x: 2000, y: 3000,
    widthMm: 1200, depthMm: 6000, riseMm: 600, elevationMm: 0, rotation: 90,
    materialId: 'concrete-grey', route: { landingMm: 2500, turn: 'right', secondDepthMm: 4000, secondRiseMm: 400 } }];
  const options = { ...defaultRenderDesignOptions(), freedom: 'controlled' as const, additions: ['plants' as const], placement: 'selected' as const,
    regions: [{ id: 'area', name: 'Centro', polygon: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 0, y: 1000 }] }] };
  const view = { preset: 'back' as const, position: [0, 2, -10] as [number, number, number], quaternion: [0, 1, 0, 0] as [number, number, number, number], fov: 45, aspect: 1.5, allLevels: false, cutaway: false };
  const prompt = selectedViewPrompt(doc, view, 'moderno', 'Conservar acceso', '', options, true);
  expect(prompt.length).toBeLessThan(5000);
  expect(decode(prompt)).toMatchObject({ camera: view, designOptions: { freedom: 'controlled', additions: ['plants'], regionsM: [{ polygon: [[0, 0], [1, 0], [0, 1]] }] }, levels: [{ ramps: [{ parts: [
    { kind: 'flight', startElevationM: 0, endElevationM: 0.6 },
    { kind: 'landing', startElevationM: 0.6, endElevationM: 0.6 },
    { kind: 'flight', startElevationM: 0.6, endElevationM: 1 },
  ] }] }] });
  expect(prompt).toContain('Conservar acceso');
});
