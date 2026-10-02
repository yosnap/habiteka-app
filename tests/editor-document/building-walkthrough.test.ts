import { describe, expect, it } from 'vitest';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { addBuildingLevel, switchBuildingLevel } from '@/lib/editor-document/building-levels';
import { addStair } from '@/lib/editor-document/construction-commands';
import { emptyEditorDocument, type EditorDocument } from '@/lib/editor-document/schema';
import { autoBuildingTour } from '@/lib/editor-document/building-auto-tour';
import { buildWalkthrough } from '@/lib/editor-document/walkthrough-geometry';
import { putWalkthrough } from '@/lib/editor-document/walkthrough';
import { parseEditorDocument } from '@/lib/editor-document/validation';
import { buildingSampleDocument } from '@/app/dev/editor-v2/building-sample';

function building(kind: 'straight' | 'L' | 'U' = 'straight'): EditorDocument {
  const room = addWallPath(emptyEditorDocument(), [
    { x: 0, y: 0 }, { x: 6000, y: 0 }, { x: 6000, y: 6000 }, { x: 0, y: 6000 },
  ], true);
  const upper = addBuildingLevel(room, true);
  const lower = switchBuildingLevel(upper, upper.levels![0]!.id);
  return addStair(lower, { id: 'stairs', kind, catalogId: `stair-${kind}`,
    x: kind === 'straight' ? 1000 : 500, y: kind === 'straight' ? 1000 : 500,
    widthMm: kind === 'straight' ? 1000 : 2400, depthMm: kind === 'straight' ? 2500 : 3000,
    heightMm: 2700, elevationMm: 0, rotation: 0, stepCount: 15, materialId: 'wood-oak' });
}

describe('ruta guiada entre plantas', () => {
  it('prepara la muestra de dos plantas con techo y hueco de escalera', () => {
    const doc = buildingSampleDocument(), route = autoBuildingTour(doc, 'sample-stair');
    const compiled = buildWalkthrough(doc, route), final = compiled.samplePose(compiled.durationMs);
    expect(compiled.invalidSegments).toEqual([]);
    expect(final.focus[2]).toBeGreaterThan(final.position[2]);
  });

  it('desciende desde la planta superior por el mismo enlace', () => {
    const source = building(), doc = switchBuildingLevel(source, source.levels![1]!.id);
    const route = autoBuildingTour(doc, 'stairs'), compiled = buildWalkthrough(doc, route);
    expect(compiled.invalidSegments).toEqual([]);
    expect(compiled.samplePose(0).position[1]).toBeCloseTo(4.3);
    expect(compiled.samplePose(compiled.durationMs).position[1]).toBeCloseTo(1.6);
  });

  it.each(['straight', 'L', 'U'] as const)('asciende por una escalera %s sin salto de cámara', (kind) => {
    const doc = building(kind), route = autoBuildingTour(doc, 'stairs');
    expect(route.waypoints.some((point) => point.levelId === doc.levels![1]!.id)).toBe(true);
    expect(parseEditorDocument(putWalkthrough(doc, route)).walkthroughs![0]).toEqual(route);
    const compiled = buildWalkthrough(doc, route);
    expect(compiled.absoluteElevation).toBe(true);
    expect(compiled.invalidSegments).toEqual([]);
    expect(compiled.samplePose(0).position[1]).toBeCloseTo(1.6);
    expect(compiled.samplePose(compiled.durationMs).position[1]).toBeCloseTo(4.3);
    expect(compiled.samples.every((sample, index) => !index || sample.height >= compiled.samples[index - 1]!.height - 1)).toBe(true);
  });

  it('invalida el enlace si cambia la altura o se bloquea la salida superior', () => {
    const doc = building(), route = autoBuildingTour(doc, 'stairs');
    const wrongHeight = structuredClone(doc);
    wrongHeight.stairs![0]!.heightMm = 2500;
    expect(buildWalkthrough(wrongHeight, route).invalidSegments.length).toBeGreaterThan(0);
    const blocked = structuredClone(doc);
    blocked.levels![1]!.document!.furniture.push({ id: 'blocking', kind: 'armario', x: 900, y: 400,
      widthMm: 1200, depthMm: 500, heightMm: 1800, elevationMm: 0, color: '#8ea69b',
      rotation: 0, dimensionalOrigin: 'physical' });
    expect(buildWalkthrough(blocked, route).invalidSegments.length).toBeGreaterThan(0);
  });
});
