import { describe, expect, it } from 'vitest';
import { emptyEditorDocument, type Ramp } from '@/lib/editor-document/schema';
import { landingEntranceSurfaces, landingOutlineSegments } from '@/lib/editor-document/landing-entrance-surface';
import { editorDocumentToScene } from '@/canvas/editor-v2/scene/editor-document-to-scene';

function fixture(rotation = 0) {
  const doc = emptyEditorDocument();
  const landing: Ramp = { id: 'landing', catalogId: 'builtin:ramp-landing', x: 2000, y: -1275,
    widthMm: 1200, depthMm: 1200, elevationMm: 1000, riseMm: 0, rotation: 0, materialId: 'concrete-grey' };
  doc.vertices = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 6000, y: 0 }];
  doc.walls = [{ id: 'wall', startVertexId: 'a', endVertexId: 'b', thicknessMm: 150, dimensionalOrigin: 'physical' }];
  doc.ramps = [landing];
  doc.openings = [{ id: 'opening', wallId: 'wall', kind: 'hueco', position: 2600 / 6000, widthMm: 1000,
    elevationMm: 1000, heightMm: 1700, sourceRampId: landing.id, dimensionalOrigin: 'physical' }];
  const angle = rotation * Math.PI / 180;
  const rotate = (p: { x: number; y: number }) => ({ x: p.x * Math.cos(angle) - p.y * Math.sin(angle),
    y: p.x * Math.sin(angle) + p.y * Math.cos(angle) });
  doc.vertices = doc.vertices.map((p) => ({ ...p, ...rotate(p) }));
  doc.ramps = [{ ...landing, ...rotate(landing), rotation }];
  return doc;
}

describe('continuidad del descansillo por una entrada', () => {
  it.each([0, 90, 37, 180])('atraviesa el espesor solo dentro del hueco con giro %s', (rotation) => {
    const doc = fixture(rotation), before = structuredClone(doc);
    const surfaces = landingEntranceSurfaces(doc);
    expect(surfaces).toHaveLength(1);
    const p = surfaces[0]!.points;
    expect(Math.hypot(p[1]!.x - p[0]!.x, p[1]!.y - p[0]!.y)).toBeCloseTo(1000);
    expect(Math.hypot(p[2]!.x - p[1]!.x, p[2]!.y - p[1]!.y)).toBeCloseTo(150);
    const segments = landingOutlineSegments(doc.ramps![0]!, surfaces);
    const total = segments.reduce((sum, [a, b]) => sum + Math.hypot(b!.x - a!.x, b!.y - a!.y), 0);
    expect(total).toBeCloseTo(3800); // perimeter 4800 minus only the 1000 mm entrance
    const scene = editorDocumentToScene(doc);
    const extension = scene.polygons.find((p) => p.id === 'opening:landing-surface')!;
    expect(extension.height).toBeCloseTo(1.0005);
    expect(extension.floorFinish?.color).toBe('#a6a6a0');
    expect(doc).toEqual(before);
  });
  it('no rellena ventanas, huecos a otra cota ni descansillos alejados', () => {
    const doc = fixture();
    doc.openings[0]!.kind = 'ventana';
    expect(landingEntranceSurfaces(doc)).toEqual([]);
    doc.openings[0]!.kind = 'hueco'; doc.openings[0]!.elevationMm = 1200;
    expect(landingEntranceSurfaces(doc)).toEqual([]);
    doc.openings[0]!.elevationMm = 1000; doc.ramps![0]!.y -= 600;
    expect(landingEntranceSurfaces(doc)).toEqual([]);
  });
  it('admite huecos manuales y recupera el contorno al quitar la entrada', () => {
    const doc = fixture(); delete doc.openings[0]!.sourceRampId;
    expect(landingEntranceSurfaces(doc)).toHaveLength(1);
    doc.openings = [];
    expect(landingEntranceSurfaces(doc)).toEqual([]);
    expect(landingOutlineSegments(doc.ramps![0]!, [])).toHaveLength(4);
  });
});
