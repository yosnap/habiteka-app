import { describe, expect, it } from 'vitest';
import { emptyEditorDocument, type Opening } from '@/lib/editor-document/schema';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { openingForDrag, placeOpening, resolveOpeningPlacement } from '@/canvas/editor-v2/opening-placement';

const doc = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 6000, y: 0 },
  { x: 6000, y: 5000 }, { x: 0, y: 5000 }], true);
const opening: Opening = { id: 'door', wallId: doc.walls[0]!.id, kind: 'puerta', position: .5,
  widthMm: 900, dimensionalOrigin: 'physical' };
describe('wall-bound opening placement', () => {
  it.each(['puerta', 'ventana', 'hueco'] as const)('Option + arrastrar %s coloca una copia en el destino y conserva el original', (kind) => {
    const initial = placeOpening(doc, { ...opening, kind }, opening);
    const original = initial.openings[0]!, prototype = openingForDrag(original, true);
    const destination = resolveOpeningPlacement(initial, { x: 4800, y: 0 }, .1, prototype)!;
    expect(destination.valid).toBe(true);
    const result = placeOpening(initial, prototype, destination);
    expect(result.openings).toHaveLength(2);
    expect(result.openings.find(item => item.id === original.id)).toEqual(original);
    expect(result.openings.find(item => item.id === prototype.id)).toMatchObject({ kind, position: .8, widthMm: original.widthMm });
    expect(initial.openings).toHaveLength(1);
    const overlapping = resolveOpeningPlacement(initial, { x: 3000, y: 0 }, .1, prototype)!;
    expect(overlapping.valid).toBe(false);
    expect(() => placeOpening(initial, prototype, overlapping)).toThrow();
  });
  it('sin Option el arrastre conserva el ID y mueve el hueco existente', () => {
    const initial = placeOpening(doc, opening, opening), original = initial.openings[0]!;
    const prototype = openingForDrag(original, false);
    const destination = resolveOpeningPlacement(initial, { x: 4800, y: 0 }, .1, prototype)!;
    const result = placeOpening(initial, prototype, destination);
    expect(result.openings).toHaveLength(1); expect(result.openings[0]!.id).toBe(original.id);
  });
  it('conserva el agarre al desplazar y girar hacia otro anfitrión', () => {
    const same = resolveOpeningPlacement(doc, { x: 3400, y: 0 }, .1, opening, undefined, 400)!;
    expect(same.center).toEqual({ x: 3000, y: 0 });
    const rotated = resolveOpeningPlacement(doc, { x: 6000, y: 3400 }, .1, opening, undefined, 400)!;
    expect(rotated.center.y).toBeCloseTo(3000);
  });
  it('reasigna el mismo ID y gira de horizontal a vertical sin cambiar medidas', () => {
    const initial = placeOpening(doc, opening, opening);
    const p = resolveOpeningPlacement(initial, { x: 6040, y: 2800 }, .1, opening)!;
    expect(p.valid).toBe(true); expect(p.rotation).toBe(90);
    const moved = placeOpening(initial, opening, p);
    expect(moved.openings).toHaveLength(1);
    expect(moved.openings[0]).toMatchObject({ id: 'door', wallId: doc.walls[1]!.id, widthMm: 900 });
    expect(initial.openings[0]!.wallId).toBe(doc.walls[0]!.id);
  });
  it('acota al semiancho más holgura de esquina y calcula distancias reales al eje', () => {
    const p = resolveOpeningPlacement(doc, { x: 40, y: -10 }, .1, opening)!;
    expect(p.beforeMm).toBe(75); expect(p.afterMm).toBe(5025);
  });
  it('rechaza commit directo que invada esquina aunque se omita el resolver', () => {
    expect(() => placeOpening(doc, opening, { wallId: opening.wallId, position: 450 / 6000 })).toThrow(/esquina/);
    expect(doc.openings).toHaveLength(0);
  });
  it('admite borde cero en extremo libre y rechaza muros sin longitud libre suficiente', () => {
    const free = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 6000, y: 0 }]);
    const p = resolveOpeningPlacement(free, { x: 0, y: 0 }, .1, opening)!;
    expect(p.beforeMm).toBe(0); expect(p.valid).toBe(true);
    const narrow = resolveOpeningPlacement(doc, { x: 3000, y: 0 }, .1, { ...opening, widthMm: 5900 })!;
    expect(narrow.valid).toBe(false); expect(narrow.reason).toMatch(/esquinas/);
  });
  it('no elige muros lejanos y conserva el documento ante solapes', () => {
    expect(resolveOpeningPlacement(doc, { x: 3000, y: 2500 }, .1, opening)).toBeNull();
    const occupied = placeOpening(doc, { ...opening, id: 'other' }, opening);
    const p = resolveOpeningPlacement(occupied, { x: 3000, y: 0 }, .1, opening)!;
    expect(p.valid).toBe(false); expect(p.reason).toMatch(/superpuestas/);
    expect(() => placeOpening(occupied, opening, p)).toThrow();
    expect(occupied.openings).toHaveLength(1);
  });
  it('no finge encaje si la abertura supera la longitud del muro', () => {
    const p = resolveOpeningPlacement(doc, { x: 3000, y: 0 }, .1, { ...opening, widthMm: 7000 })!;
    expect(p.valid).toBe(false);
  });
});
