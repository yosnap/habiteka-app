import { describe, expect, it } from 'vitest';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { setExteriorRoof, exteriorRoofSchema } from '@/lib/editor-document/exterior-roof';
import { exteriorRoofGeometry } from '@/lib/editor-document/exterior-roof-geometry';
import { exteriorRoofFootprints } from '@/lib/editor-document/exterior-roof-footprint';
import { parseEditorDocument } from '@/lib/editor-document/validation';
import { addBuildingLevel, switchBuildingLevel } from '@/lib/editor-document/building-levels';
import { ceilingDesignContext } from '@/lib/editor-document/ceiling-design-context';
import { sameDesignContent } from '@/lib/editor-document/approved-design';
import { scenePresetFocus } from '@/components/editor-v2/scene/scene-preset-focus';
import { showcaseFrame } from '@/components/editor-v2/scene/showcase-timeline';
const room = () => addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 6000, y: 0 }, { x: 6000, y: 4000 }, { x: 0, y: 4000 }], true);
const courtyard = () => {
  let doc = addWallPath(room(), [{ x: 2000, y: 1000 }, { x: 4000, y: 1000 }, { x: 4000, y: 3000 }, { x: 2000, y: 3000 }], true);
  for (const [a, b] of [[{ x: 0, y: 0 }, { x: 2000, y: 1000 }], [{ x: 6000, y: 0 }, { x: 4000, y: 1000 }],
    [{ x: 6000, y: 4000 }, { x: 4000, y: 3000 }], [{ x: 0, y: 4000 }, { x: 2000, y: 3000 }]]) doc = addWallPath(doc, [a!, b!]);
  doc.labels.push({ id: 'patio', x: 3000, y: 2000, text: 'Patio' });
  return doc;
};
describe('tejado exterior', () => {
  it('cierra los huecos centrales de un tejado nuevo y conserva la opción abierta antigua al editarlo', () => {
    const doc = setExteriorRoof(courtyard(), {});
    expect(doc.exteriorRoof?.voidCover).toBe('solid');
    expect(exteriorRoofFootprints(doc)[0]!.rings).toHaveLength(1);
    delete doc.exteriorRoof!.voidCover;
    const legacy = setExteriorRoof(doc, { pitchDeg: 20 });
    expect(legacy.exteriorRoof?.voidCover).toBe('open');
    expect(exteriorRoofFootprints(legacy)[0]!.rings).toHaveLength(2);
    expect(exteriorRoofFootprints(setExteriorRoof(legacy, { voidCover: 'solid' }))[0]!.rings).toHaveLength(1);
  });

  it.each(['flat', 'mono', 'gable', 'hip'] as const)('el cristal manual cierra el vacío siguiendo la pendiente %s y persiste en el contexto', kind => {
    const doc = setExteriorRoof(courtyard(), { kind, voidCover: 'glass', orientationDeg: 37, eavesMm: 200 });
    const parts = exteriorRoofGeometry(doc), glass = parts.find(part => part.glazing)!;
    expect(parts).toHaveLength(2);
    expect(glass.wallClosures).toHaveLength(0);
    expect([...glass.positions].every(Number.isFinite)).toBe(true);
    expect(glass.indices.length).toBeGreaterThan(0);
    const angle = 37 * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
    const ring = exteriorRoofFootprints(doc)[0]!.rings[0]!;
    const u = ring.map(p => (p.x * c + p.y * s) / 1000), v = ring.map(p => (-p.x * s + p.y * c) / 1000);
    const minU = Math.min(...u), maxU = Math.max(...u), minV = Math.min(...v), maxV = Math.max(...v);
    for (let i = 0; i < glass.positions.length; i += 3) {
      const x = glass.positions[i]!, z = glass.positions[i + 2]!, a = x * c + z * s, b = -x * s + z * c;
      const rise = kind === 'flat' ? 0 : kind === 'mono' ? b - minV : kind === 'gable' ? Math.min(b - minV, maxV - b)
        : Math.min(a - minU, maxU - a, b - minV, maxV - b);
      const top = glass.baseM + .16 + rise * Math.tan(25 * Math.PI / 180);
      expect(Math.min(Math.abs(glass.positions[i + 1]! - top), Math.abs(glass.positions[i + 1]! - top + .02))).toBeLessThan(.00001);
    }
    expect(ceilingDesignContext(doc).exteriorRoof?.footprints.some(part => 'glazing' in part && part.glazing)).toBe(true);
    expect(parseEditorDocument(JSON.parse(JSON.stringify(doc))).exteriorRoof?.voidCover).toBe('glass');
  });
  it('persiste sin mutar el plano y participa en la aprobación y el contexto de imagen', () => {
    const original = room(), roof = setExteriorRoof(original, {});
    expect(original.exteriorRoof).toBeUndefined();
    expect(parseEditorDocument(JSON.parse(JSON.stringify(roof)))).toEqual(roof);
    expect(sameDesignContent(original, roof)).toBe(false);
    expect(ceilingDesignContext(roof).exteriorRoof?.footprints).toHaveLength(1);
    const upper = addBuildingLevel(roof);
    expect(upper.exteriorRoof).toBeUndefined();
    expect(switchBuildingLevel(upper, upper.levels![0]!.id).exteriorRoof).toEqual(roof.exteriorRoof);
  });
  it.each(['flat', 'mono', 'gable', 'hip'] as const)('cierra el volumen %s sobre los muros y genera triángulos finitos', kind => {
    const roof = setExteriorRoof(room(), { kind, eavesMm: 0, pitchDeg: 30 });
    const part = exteriorRoofGeometry(roof)[0]!;
    expect([...part.positions].every(Number.isFinite)).toBe(true);
    expect(Math.min(...[...part.positions].filter((_, i) => i % 3 === 1))).toBeCloseTo(part.baseM);
    expect(part.peakM).toBeGreaterThan(part.baseM);
    expect(Math.max(...part.indices)).toBeLessThan(part.positions.length / 3);
    expect(part.indices.length % 3).toBe(0);
  });
  it('respeta el hueco central de un patio y bloquea referencias a habitaciones eliminadas', () => {
    let doc = addWallPath(room(), [{ x: 2000, y: 1000 }, { x: 4000, y: 1000 }, { x: 4000, y: 3000 }, { x: 2000, y: 3000 }], true);
    for (const [a, b] of [[{ x: 0, y: 0 }, { x: 2000, y: 1000 }], [{ x: 6000, y: 0 }, { x: 4000, y: 1000 }],
      [{ x: 6000, y: 4000 }, { x: 4000, y: 3000 }], [{ x: 0, y: 4000 }, { x: 2000, y: 3000 }]]) doc = addWallPath(doc, [a!, b!]);
    doc.labels.push({ id: 'patio', x: 3000, y: 2000, text: 'Patio' });
    doc = setExteriorRoof(doc, { voidCover: 'open' });
    expect(exteriorRoofFootprints(doc)[0]!.rings).toHaveLength(2);
    doc.walls = [];
    expect(() => exteriorRoofGeometry(doc)).toThrow(/estancias/);
  });
  it('rechaza pendientes, materiales y selecciones inválidas', () => {
    const config = setExteriorRoof(room(), {}).exteriorRoof!;
    expect(() => exteriorRoofSchema.parse({ ...config, kind: 'hip', pitchDeg: 0 })).toThrow();
    expect(() => exteriorRoofSchema.parse({ ...config, roomIds: [] })).toThrow();
    expect(() => exteriorRoofSchema.parse({ ...config, materialId: 'inventado' })).toThrow();
  });
  it.each(['mono', 'gable', 'hip'] as const)('prolonga los muros hasta el intradós %s, incluso con cubierta girada', kind => {
    const doc = setExteriorRoof(room(), { kind, orientationDeg: 37, eavesMm: 250, pitchDeg: 30 });
    const footprint = exteriorRoofFootprints(doc)[0]!, part = exteriorRoofGeometry(doc)[0]!;
    const angle = 37 * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
    const project = (x: number, y: number) => [(x * c + y * s) / 1000, (-x * s + y * c) / 1000];
    const points = footprint.rings[0]!.map(p => project(p.x, p.y));
    const minU = Math.min(...points.map(p => p[0]!)), maxU = Math.max(...points.map(p => p[0]!));
    const minV = Math.min(...points.map(p => p[1]!)), maxV = Math.max(...points.map(p => p[1]!));
    expect(part.wallClosures).toHaveLength(doc.walls.length);
    for (const closure of part.wallClosures) {
      expect(closure.buildBaseM).toBe(0);
      expect([...closure.positions, ...closure.uvs].every(Number.isFinite)).toBe(true);
      expect(Math.max(...closure.indices)).toBeLessThan(closure.positions.length / 3);
      for (let i = 0; i < closure.positions.length; i += 3) {
        const [u, v] = project(closure.positions[i]! * 1000, closure.positions[i + 2]! * 1000);
        const rise = kind === 'mono' ? v! - minV : kind === 'gable' ? Math.min(v! - minV, maxV - v!)
          : Math.min(u! - minU, maxU - u!, v! - minV, maxV - v!);
        const y = closure.positions[i + 1]!;
        // Cada vértice queda en la coronación original o en la cara inferior de la cubierta.
        expect(Math.min(Math.abs(y - part.baseM), Math.abs(y - (part.baseM + rise * Math.tan(Math.PI / 6))))).toBeLessThan(.00001);
      }
    }
  });
  it('no crea hastiales innecesarios con cubierta plana ni prolonga muros exteriores ajenos a sus estancias', () => {
    const doc = setExteriorRoof(room(), { kind: 'flat' });
    expect(exteriorRoofGeometry(doc)[0]!.wallClosures).toHaveLength(0);
    const separate = addWallPath(doc, [{ x: 10000, y: 0 }, { x: 12000, y: 0 }]);
    const pitched = setExteriorRoof(separate, { kind: 'gable' });
    expect(exteriorRoofGeometry(pitched)[0]!.wallClosures.map(p => p.wallId)).not.toContain(separate.walls.at(-1)!.id);
  });
  it('encuadra la altura del tejado y las plantas del edificio en el vuelo', () => {
    const roof = setExteriorRoof(room(), { kind: 'gable', pitchDeg: 60 });
    const peak = exteriorRoofGeometry(roof)[0]!.peakM, focus = scenePresetFocus(roof, 'drone')!;
    expect(focus.center[1] + focus.size[1] / 2).toBeGreaterThan(peak);
    const upper = addBuildingLevel(roof, true), shot = showcaseFrame(upper, 14000);
    expect(shot.focus[1]).toBeGreaterThan(peak / 2);
    expect(shot.position[1]).toBeGreaterThan(peak + 2.7);
  });
});
