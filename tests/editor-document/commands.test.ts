import { describe, expect, it } from 'vitest';
import { emptyEditorDocument, type EditorDocument } from '@/lib/editor-document/schema';
import { applyCommand } from '@/lib/editor-document/commands';
import { upgradeConstructionDocument } from '@/lib/editor-document/migrations';
import { interpolate, wallPoints } from '@/lib/editor-document/geometry';

function openingCenter(doc: EditorDocument) {
  const opening = doc.openings[0]!;
  return interpolate(...wallPoints(doc, doc.walls.find((wall) => wall.id === opening.wallId)!), opening.position);
}

function fixture() {
  const doc = emptyEditorDocument();
  doc.calibration = { mmPerPixel: 10 };
  doc.vertices = [
    { id: 'a', x: 0, y: 0 },
    { id: 'b', x: 6000, y: 0 },
  ];
  doc.walls = [
    {
      id: 'w',
      startVertexId: 'a',
      endVertexId: 'b',
      thicknessMm: 150,
      dimensionalOrigin: 'raster',
    },
  ];
  doc.openings = [
    {
      id: 'o',
      wallId: 'w',
      kind: 'hueco',
      position: 0.25,
      widthMm: 800,
      dimensionalOrigin: 'physical',
    },
  ];
  return doc;
}
describe('pure geometric commands', () => {
  it('inverts orientation without moving the physical opening and is reversible', () => {
    const doc = fixture();
    const original = structuredClone(doc);
    const reversed = applyCommand(doc, { type: 'invert-wall', wallId: 'w' });
    expect(reversed.openings[0]?.position).toBe(0.75);
    expect(openingCenter(reversed)).toEqual(openingCenter(doc));
    expect(applyCommand(reversed, { type: 'invert-wall', wallId: 'w' })).toEqual(upgradeConstructionDocument(doc));
    expect(doc).toEqual(original);
    expect(doc.openings[0]?.position).toBe(0.25);
  });
  it('splits and merges preserving center, width and IDs', () => {
    const doc = fixture();
    const original = structuredClone(doc);
    const split = applyCommand(doc, {
      type: 'split-wall',
      wallId: 'w',
      position: 0.5,
      vertexId: 'm',
      newWallId: 'w2',
    });
    expect(split.openings[0]).toMatchObject({ position: 0.5, widthMm: 800 });
    expect(openingCenter(split)).toEqual(openingCenter(doc));
    expect(applyCommand(split, { type: 'merge-walls', wallId: 'w', otherWallId: 'w2' })).toEqual(
      upgradeConstructionDocument(doc),
    );
    expect(doc).toEqual(original);
  });
  it('rejects splitting through an opening without modifying source', () => {
    const doc = fixture();
    const saved = structuredClone(doc);
    expect(() =>
      applyCommand(doc, {
        type: 'split-wall',
        wallId: 'w',
        position: 0.25,
        vertexId: 'm',
        newWallId: 'w2',
      }),
    ).toThrow();
    expect(doc).toEqual(saved);
  });
  it('moves the shared vertex without duplicating it', () => {
    const doc = fixture();
    doc.vertices.push({ id: 'c', x: 6000, y: 4000 });
    doc.walls.push({ ...doc.walls[0]!, id: 'w2', startVertexId: 'b', endVertexId: 'c' });
    const moved = applyCommand(doc, { type: 'move-vertex', vertexId: 'b', x: 6500, y: 0 });
    expect(moved.walls[0]?.endVertexId).toBe(moved.walls[1]?.startVertexId);
    expect(moved.vertices.find((v) => v.id === 'b')?.x).toBe(6500);
  });
  it('recalibration preserves physical furniture dimensions but scales raster dimensions', () => {
    const doc = fixture();
    doc.furniture = [
      {
        id: 'sofa',
        kind: 'sofa',
        x: 500,
        y: 1000,
        widthMm: 2000,
        depthMm: 900,
        rotation: 30,
        dimensionalOrigin: 'physical',
      },
    ];
    const scaled = applyCommand(doc, { type: 'recalibrate', factor: 2 });
    expect(scaled.furniture[0]).toMatchObject({ x: 1000, y: 2000, widthMm: 2000, depthMm: 900 });
    expect(scaled.walls[0]?.thicknessMm).toBe(300);
    expect(scaled.openings[0]?.widthMm).toBe(800);
    expect(scaled.calibration?.mmPerPixel).toBe(20);
  });
  it('remaps an opening onto the second split wall, including reversed merge orientation', () => {
    const doc = fixture();
    doc.openings[0]!.position = 0.75;
    const original = structuredClone(doc);
    const split = applyCommand(doc, {
      type: 'split-wall',
      wallId: 'w',
      position: 0.5,
      vertexId: 'm',
      newWallId: 'w2',
    });
    expect(split.openings[0]).toMatchObject({ wallId: 'w2', position: 0.5 });
    const reversed = applyCommand(split, { type: 'invert-wall', wallId: 'w2' });
    const merged = applyCommand(reversed, { type: 'merge-walls', wallId: 'w', otherWallId: 'w2' });
    expect(openingCenter(reversed)).toEqual(openingCenter(doc));
    expect(openingCenter(merged)).toEqual(openingCenter(doc));
    expect(merged).toEqual(upgradeConstructionDocument(doc));
    expect(doc).toEqual(original);
  });
  it('rejects invalid lengths, duplicate IDs and non-collinear merges', () => {
    const doc = fixture();
    expect(() => applyCommand(doc, { type: 'move-vertex', vertexId: 'b', x: 500, y: 0 })).toThrow();
    expect(() =>
      applyCommand(doc, {
        type: 'split-wall',
        wallId: 'w',
        position: 0.5,
        vertexId: 'a',
        newWallId: 'w2',
      }),
    ).toThrow();
    const split = applyCommand(doc, {
      type: 'split-wall',
      wallId: 'w',
      position: 0.5,
      vertexId: 'm',
      newWallId: 'w2',
    });
    const bent = applyCommand(split, { type: 'move-vertex', vertexId: 'm', x: 3000, y: 1000 });
    expect(() =>
      applyCommand(bent, { type: 'merge-walls', wallId: 'w', otherWallId: 'w2' }),
    ).toThrow('colineales');
  });
  it('rejects recalibration when physical opening no longer fits', () => {
    const doc = fixture();
    const original = structuredClone(doc);
    expect(() => applyCommand(doc, { type: 'recalibrate', factor: 0.1 })).toThrow();
    expect(doc).toEqual(original);
  });
});
