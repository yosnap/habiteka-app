import { describe, expect, it } from 'vitest';
import { emptyEditorDocument, type EditorDocument, type LightStrip, type Point } from '@/lib/editor-document/schema';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { setRoomCeiling } from '@/lib/editor-document/ceiling-commands';
import { upgradeLightingDocument } from '@/lib/editor-document/lighting-migration';
import {
  COVE_INSET_MM,
  coveRing,
  derivedStripPath,
  insetPolygon,
  lightStripIssue,
  resolvedStrips,
  stripRoomId,
} from '@/lib/editor-document/light-strip-geometry';
import { stripLengthMm } from '@/lib/editor-document/light-strip-types';

const plan = (points: Point[]) => addWallPath(emptyEditorDocument(), points, true);
const rectangle = (width: number, depth: number) =>
  plan([{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: depth }, { x: 0, y: depth }]);
/** Estancia en L, para probar el retranqueo con un vértice cóncavo. */
const ele = () => plan([
  { x: 0, y: 0 }, { x: 6000, y: 0 }, { x: 6000, y: 3000 },
  { x: 3000, y: 3000 }, { x: 3000, y: 6000 }, { x: 0, y: 6000 },
]);

const suspended = (base: EditorDocument, dropMm = 150) =>
  setRoomCeiling(base, deriveRooms(base)[0]!.id, { kind: 'suspended', dropMm });

const cove = (doc: EditorDocument, patch: Partial<LightStrip> = {}): LightStrip => ({
  id: 'cove-1', kind: 'cove', ceilingId: doc.ceilings![0]!.id,
  pathMm: coveRing(deriveRooms(doc)[0]!.boundary) ?? [{ x: 0, y: 0 }, { x: 1000, y: 0 }],
  derived: true, elevationMm: 2500, color: '#ffe6bf', temperatureK: 2700, lumensPerMeter: 600, enabled: true, ...patch,
});
const free = (patch: Partial<LightStrip> = {}): LightStrip => ({
  // Adosado al muro norte: a 125 mm de su cara interior.
  id: 'free-1', kind: 'free', pathMm: [{ x: 500, y: 200 }, { x: 3500, y: 200 }],
  derived: false, elevationMm: 2400, color: '#ffe6bf', temperatureK: 3000, lumensPerMeter: 600, enabled: true, ...patch,
});
const withStrips = (doc: EditorDocument, strips: LightStrip[]) =>
  upgradeLightingDocument({ ...doc, lightStrips: strips });

describe('retranqueo del contorno', () => {
  it('encoge un rectángulo por los cuatro lados', () => {
    const inset = insetPolygon([{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 }], 150);
    expect(inset).toEqual([
      { x: 150, y: 150 }, { x: 3850, y: 150 }, { x: 3850, y: 2850 }, { x: 150, y: 2850 },
    ]);
  });

  it('funciona igual con el contorno recorrido al revés', () => {
    const inset = insetPolygon([{ x: 0, y: 3000 }, { x: 4000, y: 3000 }, { x: 4000, y: 0 }, { x: 0, y: 0 }], 150);
    expect(inset?.every((point) => point.x >= 150 && point.x <= 3850)).toBe(true);
  });

  it('conserva el vértice cóncavo de una estancia en L', () => {
    const boundary = deriveRooms(ele())[0]!.boundary;
    const ring = coveRing(boundary);
    expect(ring).not.toBeNull();
    expect(ring!.length).toBe(boundary.length + 1);
    expect(ring![0]).toEqual(ring!.at(-1));
  });

  it('rechaza una estancia demasiado estrecha para el foseado', () => {
    expect(coveRing(deriveRooms(rectangle(6000, 240))[0]!.boundary)).toBeNull();
  });
});

describe('recorrido derivado del foseado', () => {
  it('mide el perímetro menos ocho veces el retranqueo', () => {
    const doc = suspended(rectangle(5000, 4000));
    const boundary = deriveRooms(doc)[0]!.boundary;
    const perimeter = stripLengthMm([...boundary, boundary[0]!]);
    const path = derivedStripPath(doc, cove(doc));
    expect(stripLengthMm(path!)).toBeCloseTo(perimeter - 8 * COVE_INSET_MM, 6);
  });

  it('no deriva nada sobre un techo plano', () => {
    const base = rectangle(5000, 4000);
    const doc = setRoomCeiling(base, deriveRooms(base)[0]!.id);
    expect(derivedStripPath(doc, cove(doc))).toBeNull();
  });

  it('sigue al muro cuando la estancia cambia de tamaño', () => {
    const small = withStrips(suspended(rectangle(4000, 4000)), []);
    const stripA = cove(small);
    const big = suspended(rectangle(6000, 4000));
    const before = stripLengthMm(derivedStripPath(small, stripA)!);
    const after = stripLengthMm(derivedStripPath(big, { ...stripA, ceilingId: big.ceilings![0]!.id })!);
    expect(after).toBeGreaterThan(before);
  });

  it('una tira editada a mano conserva su recorrido', () => {
    const doc = suspended(rectangle(5000, 4000));
    const manual = cove(doc, { derived: false, pathMm: [{ x: 1000, y: 1000 }, { x: 3000, y: 1000 }] });
    const resolved = resolvedStrips(withStrips(doc, [manual]))[0]!;
    expect(resolved.pathMm).toEqual(manual.pathMm);
    expect(resolved.lengthMm).toBeCloseTo(2000, 6);
  });
});

describe('incidencias de colocación', () => {
  it('avisa del foseado sobre un techo plano', () => {
    const base = rectangle(5000, 4000);
    const doc = setRoomCeiling(base, deriveRooms(base)[0]!.id);
    expect(lightStripIssue(doc, cove(doc))).toMatch(/falso techo/);
  });

  it('avisa del foseado a mano que se sale de la estancia', () => {
    const doc = suspended(rectangle(5000, 4000));
    const strip = cove(doc, { derived: false, pathMm: [{ x: -4000, y: -4000 }, { x: -1000, y: -4000 }] });
    expect(lightStripIssue(doc, strip)).toMatch(/se sale de la estancia/);
  });

  it('avisa del tramo libre fuera de toda estancia', () => {
    const doc = suspended(rectangle(5000, 4000));
    const strip = free({ pathMm: [{ x: 20000, y: 20000 }, { x: 23000, y: 20000 }] });
    expect(lightStripIssue(doc, strip)).toMatch(/dentro de una estancia/);
  });

  it('avisa del tramo libre que no cabe bajo el techo', () => {
    const doc = suspended(rectangle(5000, 4000));
    expect(lightStripIssue(doc, free({ elevationMm: 2600 }))).toMatch(/Baja la cota/);
    expect(lightStripIssue(doc, free({ elevationMm: 2000 }))).toBeNull();
  });

  it('avisa del tramo libre demasiado corto', () => {
    const doc = suspended(rectangle(5000, 4000));
    const strip = free({ pathMm: [{ x: 500, y: 500 }, { x: 700, y: 500 }] });
    expect(lightStripIssue(doc, strip)).toMatch(/al menos 300 mm/);
  });
});

describe('tiras resueltas', () => {
  it('omite las tiras con incidencia y calcula lúmenes por metro', () => {
    const doc = suspended(rectangle(5000, 4000));
    const strips = resolvedStrips(withStrips(doc, [free(), free({ id: 'free-2', pathMm: [{ x: 20000, y: 200 }, { x: 23000, y: 200 }] })]));
    expect(strips).toHaveLength(1);
    expect(strips[0]!.lumens).toBeCloseTo(3 * 600, 6);
    expect(strips[0]!.direction).toBe('out');
  });

  it('el foseado ilumina hacia el techo y cuenta con su estancia', () => {
    const doc = suspended(rectangle(5000, 4000));
    const strip = cove(doc);
    const resolved = resolvedStrips(withStrips(doc, [strip]))[0]!;
    expect(resolved.direction).toBe('up');
    expect(resolved.roomId).toBe(deriveRooms(doc)[0]!.id);
    expect(stripRoomId(doc, strip)).toBe(resolved.roomId);
  });

  it('un tramo libre en el centro de la estancia ilumina hacia abajo', () => {
    const doc = suspended(rectangle(6000, 6000));
    const strip = free({ pathMm: [{ x: 2000, y: 3000 }, { x: 4000, y: 3000 }] });
    expect(resolvedStrips(withStrips(doc, [strip]))[0]!.direction).toBe('down');
  });
});
