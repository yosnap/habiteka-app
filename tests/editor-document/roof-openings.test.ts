import { describe, expect, it } from 'vitest';
import { BufferAttribute, BufferGeometry, DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { setExteriorRoof } from '@/lib/editor-document/exterior-roof';
import { exteriorRoofGeometry, type RoofGeometry } from '@/lib/editor-document/exterior-roof-geometry';
import { exteriorRoofFootprints } from '@/lib/editor-document/exterior-roof-footprint';
import { deleteRoofOpening, makeRoofGlassEditable, putRoofOpening, rectangleRoofOpening, placedRoofOpening, roofCeilingVoids } from '@/lib/editor-document/roof-opening-commands';
import { roofOpeningPoints } from '@/lib/editor-document/roof-opening-types';
import { parseEditorDocument } from '@/lib/editor-document/validation';
import { ceilingShapes } from '@/components/editor-v2/scene/ceiling-scene-utils';
import { ceilingDesignContext } from '@/lib/editor-document/ceiling-design-context';
import { buildEditorRenderContract } from '@/lib/editor-document/render-contract';
import { sameDesignContent } from '@/lib/editor-document/approved-design';
import { addBuildingLevel, switchBuildingLevel } from '@/lib/editor-document/building-levels';
import { roofPlanFacets } from '@/lib/editor-document/roof-slope-cells';

const room = () => addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 6000, y: 0 }, { x: 6000, y: 4000 }, { x: 0, y: 4000 }], true);
const opening = (kind: 'glass' | 'roof-window' = 'glass') => rectangleRoofOpening({ x: 1000, y: 500 }, { x: 2000, y: 1500 }, kind, 'glass-test');
function hit(part: RoofGeometry, x: number, z: number) {
  const geometry = new BufferGeometry(); geometry.setAttribute('position', new BufferAttribute(part.positions, 3)); geometry.setIndex(new BufferAttribute(part.indices, 1));
  const material = new MeshBasicMaterial({ side: DoubleSide }), mesh = new Mesh(geometry, material);
  mesh.updateMatrixWorld();
  const result = new Raycaster(new Vector3(x, 30, z), new Vector3(0, -1, 0)).intersectObject(mesh).length;
  geometry.dispose(); material.dispose();
  return result;
}

describe('cristales y ventanas manuales del tejado', () => {
  it('un clic coloca una ventana con tamaño inicial, un arrastre elige su tamaño y la cumbrera sigue protegida', () => {
    const roof = setExteriorRoof(room(), { kind: 'gable' });
    const point = { x: 3000, y: 1000 }, window = placedRoofOpening(point, point, 'roof-window', 'click-window');
    expect(window).toMatchObject({ x: 2610, y: 410, widthMm: 780, depthMm: 1180 });
    expect(() => putRoofOpening(roof, window)).not.toThrow();
    expect(placedRoofOpening(point, { x: 4000, y: 1500 }, 'roof-window', 'drag-window')).toMatchObject({ widthMm: 1000, depthMm: 500 });
    const ridge = placedRoofOpening({ x: 3000, y: 2000 }, { x: 3000, y: 2000 }, 'roof-window', 'ridge-window');
    expect(() => putRoofOpening(roof, ridge)).toThrow(/una sola pendiente/);
    expect(roofPlanFacets(roof)).toHaveLength(2);
    expect(roofPlanFacets(roof).every(ring => ring.some(p => Math.abs(p.y - 2000) < .01))).toBe(true);
  });

  it.each(['flat', 'gable', 'hip'] as const)('una chimenea en cubierta %s tiene conducto hueco, altura editable y no se convierte en vidrio', kind => {
    const roof = setExteriorRoof(room(), { kind }), point = { x: 3000, y: 2000 };
    const chimney = placedRoofOpening(point, point, 'chimney', 'chimney-test');
    const doc = putRoofOpening(roof, chimney), parts = exteriorRoofGeometry(doc), body = parts.find(part => part.chimney)!;
    expect(parts.some(part => part.glazing || part.frame)).toBe(false);
    expect(parts.every(part => hit(part, 3, 2) === 0)).toBe(true);
    expect(hit(body, 2.77, 2)).toBeGreaterThan(0);
    expect(body.wallClosures).toEqual([]);
    // La textura de los laterales debe tener superficie UV, no una línea estirada verticalmente.
    for (let i = 0; i < body.indices.length; i += 3) {
      const ids = [body.indices[i]!, body.indices[i + 1]!, body.indices[i + 2]!];
      const [a, b, c] = ids.map(index => [body.uvs[index * 2]!, body.uvs[index * 2 + 1]!] as const);
      const uvArea = Math.abs((b![0] - a![0]) * (c![1] - a![1]) - (b![1] - a![1]) * (c![0] - a![0]));
      expect(uvArea).toBeGreaterThan(0);
    }
    expect(roofCeilingVoids(doc)).toHaveLength(1);
    expect(parseEditorDocument(JSON.parse(JSON.stringify(doc))).exteriorRoof!.openings).toEqual([chimney]);
    const higher = putRoofOpening(doc, { ...chimney, heightMm: 2100 });
    expect(exteriorRoofGeometry(higher).find(part => part.chimney)!.peakM - body.peakM).toBeCloseTo(.9, 5);
    expect(ceilingDesignContext(higher).exteriorRoof!.openings![0]).toMatchObject({ kind: 'chimney', dimensionsM: { width: .5, depth: .5, height: 2.1 } });
    const contract = buildEditorRenderContract(higher);
    expect(JSON.stringify(contract)).toContain('salida de chimenea');
    expect(JSON.stringify(contract)).toContain('heightAboveRoof');
    expect(deleteRoofOpening(doc, chimney.id).exteriorRoof!.openings).toEqual([]);
  });
  it('construye una cubierta de cuatro aguas con alero por defecto sin errores de recorte numérico', () => {
    expect(() => exteriorRoofGeometry(setExteriorRoof(room(), { kind: 'hip' }))).not.toThrow();
  });
  it.each(['flat', 'mono', 'gable', 'hip'] as const)('recorta de verdad la cubierta %s y el vidrio sigue sus facetas', kind => {
    const original = setExteriorRoof(room(), { kind, orientationDeg: 21 }), doc = putRoofOpening(original, opening());
    expect(original.exteriorRoof!.openings).toBeUndefined();
    const parts = exteriorRoofGeometry(doc), glass = parts.find(part => part.glazing)!;
    expect(parts.filter(part => !part.glazing).every(part => hit(part, 1.5, 1) === 0)).toBe(true);
    expect(hit(glass, 1.5, 1)).toBeGreaterThan(0);
    expect(glass.openingId).toBe('glass-test');
    expect(glass.wallClosures).toHaveLength(0);
    expect([...glass.positions].every(Number.isFinite)).toBe(true);
    expect(parseEditorDocument(JSON.parse(JSON.stringify(doc))).exteriorRoof!.openings).toEqual([opening()]);
    expect(sameDesignContent(original, doc)).toBe(false);
  });

  it('genera marco y vidrio para una ventana de ático, sin material opaco debajo', () => {
    const doc = putRoofOpening(setExteriorRoof(room(), { kind: 'gable' }), opening('roof-window'));
    const parts = exteriorRoofGeometry(doc);
    expect(parts.some(part => part.frame && part.openingId === 'glass-test')).toBe(true);
    expect(parts.filter(part => !part.glazing).every(part => hit(part, 1.5, 1) === 0)).toBe(true);
    expect(parts.find(part => part.frame)!.wallClosures).toEqual([]);
    expect(roofCeilingVoids(doc).some(ring => ring.some(p => p.x === 1000 && p.y === 500))).toBe(true);
    const shapes = ceilingShapes([{ x: 0, y: 0 }, { x: 6000, y: 0 }, { x: 6000, y: 4000 }, { x: 0, y: 4000 }], roofCeilingVoids(doc));
    expect(shapes).toHaveLength(1);
    expect(shapes[0]!.holes).toHaveLength(1);
  });

  it('bloquea salida de cubierta, solapes y ventana sobre una cumbrera, sin aplicar parcialmente', () => {
    const source = putRoofOpening(setExteriorRoof(room(), {}), opening());
    const before = JSON.stringify(source);
    expect(() => putRoofOpening(source, { ...opening(), x: 5900 })).toThrow(/dentro/);
    expect(() => putRoofOpening(source, { ...opening(), id: 'other', x: 1200 })).toThrow(/solaparse/);
    expect(() => putRoofOpening(setExteriorRoof(room(), { kind: 'gable' }), { ...opening('roof-window'), y: 1500 })).toThrow(/cumbrera/);
    expect(JSON.stringify(source)).toBe(before);
    expect(() => putRoofOpening(source, { ...opening(), widthMm: 100 })).toThrow();
  });

  it('editar, eliminar, deshacer y cambiar planta conservan el vidrio y el resto del tejado', () => {
    const initial = setExteriorRoof(room(), {}), store = createEditorStore(initial);
    store.getState().apply(putRoofOpening(store.getState().document, opening()));
    store.getState().apply(putRoofOpening(store.getState().document, { ...opening(), widthMm: 700, rotation: 30 }));
    expect(roofOpeningPoints(store.getState().document.exteriorRoof!.openings![0]!)[1]!.y).toBeCloseTo(850);
    store.getState().undo();
    expect(store.getState().document.exteriorRoof!.openings![0]!.widthMm).toBe(1000);
    store.getState().redo();
    expect(store.getState().document.exteriorRoof!.openings![0]!.widthMm).toBe(700);
    const upper = addBuildingLevel(store.getState().document);
    expect(upper.exteriorRoof).toBeUndefined();
    expect(switchBuildingLevel(upper, upper.levels![0]!.id).exteriorRoof!.openings).toHaveLength(1);
    expect(deleteRoofOpening(store.getState().document, 'glass-test').exteriorRoof!.openings).toEqual([]);
  });

  it('convierte el vidrio de un patio sin cambiar su forma y reducirlo cierra el resto con tejado', () => {
    let doc = addWallPath(room(), [{ x: 2000, y: 1000 }, { x: 4000, y: 1000 }, { x: 4000, y: 3000 }, { x: 2000, y: 3000 }], true);
    for (const [a, b] of [[{ x: 0, y: 0 }, { x: 2000, y: 1000 }], [{ x: 6000, y: 0 }, { x: 4000, y: 1000 }],
      [{ x: 6000, y: 4000 }, { x: 4000, y: 3000 }], [{ x: 0, y: 4000 }, { x: 2000, y: 3000 }]]) doc = addWallPath(doc, [a!, b!]);
    doc.labels.push({ id: 'patio', text: 'Patio', x: 3000, y: 2000 });
    doc = setExteriorRoof(doc, { voidCover: 'glass' });
    const converted = makeRoofGlassEditable(doc), oldGlass = exteriorRoofFootprints(doc).find(part => part.glazing)!;
    expect(converted.exteriorRoof!.voidCover).toBe('solid');
    expect(roofOpeningPoints(converted.exteriorRoof!.openings![0]!)).toEqual(oldGlass.rings[0]!.slice(0, -1));
    const resized = putRoofOpening(converted, { ...converted.exteriorRoof!.openings![0]!, widthMm: 1000, depthMm: 1000 });
    const parts = exteriorRoofGeometry(resized);
    expect(parts.filter(part => !part.glazing).some(part => hit(part, 3.5, 2.5) > 0)).toBe(true);
    expect(parts.find(part => part.glazing) && hit(parts.find(part => part.glazing)!, 2.5, 1.5)).toBeGreaterThan(0);
  });

  it('el contexto y el contrato IA conservan las piezas manuales en metros con marco y sin duplicación', () => {
    const doc = putRoofOpening(setExteriorRoof(room(), { kind: 'mono' }), opening('roof-window'));
    const roof = ceilingDesignContext(doc).exteriorRoof!;
    expect(roof.openings![0]).toMatchObject({ kind: 'roof-window', positionM: { x: 1, y: .5 }, dimensionsM: { width: 1, depth: 1 } });
    expect(roof.footprints.some(part => 'frame' in part && part.frame)).toBe(true);
    expect(buildEditorRenderContract(doc).elements.filter(item => item.type === 'ventana de techo')).toHaveLength(1);
  });
});
