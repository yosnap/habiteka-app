import { describe, expect, it } from 'vitest';
import { resizeOpeningFromEdge } from '@/lib/editor-document/resize-opening';

// Muro de 10 m con una ventana de 2 m centrada en 5 m (bordes en 4 m y 6 m).
const WINDOW = { position: 0.5, widthMm: 2000 };

describe('estirar un hueco desde un borde', () => {
  it('por defecto solo se mueve el borde arrastrado', () => {
    const next = resizeOpeningFromEdge(WINDOW, 10000, 1, 0.7);
    expect(next.widthMm).toBeCloseTo(3000);
    expect(next.position - next.widthMm / 10000 / 2).toBeCloseTo(0.4); // el borde izquierdo no se mueve
  });
  it('el borde izquierdo también deja fijo el derecho', () => {
    const next = resizeOpeningFromEdge(WINDOW, 10000, -1, 0.3);
    expect(next.widthMm).toBeCloseTo(3000);
    expect(next.position + next.widthMm / 10000 / 2).toBeCloseTo(0.6);
  });
  it('con Alt crece por ambos lados alrededor del centro', () => {
    const next = resizeOpeningFromEdge(WINDOW, 10000, 1, 0.7, true);
    expect(next.position).toBe(0.5);
    expect(next.widthMm).toBeCloseTo(4000);
  });
  it('no baja del ancho mínimo aunque se cruce el otro borde', () => {
    expect(resizeOpeningFromEdge(WINDOW, 10000, 1, 0.4).widthMm).toBe(50);
  });
});

describe('hueco que ocupa todo el muro', () => {
  it('va de esquina a esquina dejando solo el cuerpo de los muros adyacentes', async () => {
    const { addOpening, addWallPath } = await import('@/canvas/editor-v2/editing-operations');
    const { emptyEditorDocument } = await import('@/lib/editor-document/schema');
    const { assertOpeningClearance, fullWallOpeningSpan, wallOpeningClearance } = await import('@/lib/editor-document/opening-clearance');
    const room = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 }], true);
    const wall = room.walls[0]!;
    const doc = addOpening(room, wall.id, { x: 2000, y: 0 }, 'hueco');
    const opening = doc.openings[0]!;
    const span = fullWallOpeningSpan(doc, opening);
    const clearance = wallOpeningClearance(doc, wall);
    expect(span.widthMm).toBeCloseTo(4000 - clearance.startMm - clearance.endMm);
    expect(() => assertOpeningClearance(doc, { ...opening, ...span })).not.toThrow();
  });
});

describe('comando ocupar todo el muro', () => {
  it('estira el hueco sin mutar el documento original', async () => {
    const { addOpening, addWallPath } = await import('@/canvas/editor-v2/editing-operations');
    const { emptyEditorDocument } = await import('@/lib/editor-document/schema');
    const { fillWallWithOpening } = await import('@/lib/editor-document/opening-clearance');
    const room = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 }], true);
    const doc = addOpening(room, room.walls[0]!.id, { x: 2000, y: 0 }, 'hueco');
    const before = doc.openings[0]!.widthMm;
    const filled = fillWallWithOpening(doc, doc.openings[0]!.id);
    expect(filled.openings[0]!.widthMm).toBeGreaterThan(before);
    expect(doc.openings[0]!.widthMm).toBe(before);
  });
});

describe('hueco a toda la altura', () => {
  it('al ocupar el muro, un hueco llega del suelo a lo alto del muro; una ventana conserva su altura', async () => {
    const { addOpening, addWallPath } = await import('@/canvas/editor-v2/editing-operations');
    const { emptyEditorDocument } = await import('@/lib/editor-document/schema');
    const { fillWallWithOpening } = await import('@/lib/editor-document/opening-clearance');
    const { wallConstruction, openingConstruction } = await import('@/lib/editor-document/construction-properties');
    const room = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 }], true);
    const wall = room.walls[0]!;
    const withPassage = addOpening(room, wall.id, { x: 2000, y: 0 }, 'hueco');
    const passage = fillWallWithOpening(withPassage, withPassage.openings[0]!.id);
    expect(passage.openings[0]!.elevationMm).toBe(0);
    expect(passage.openings[0]!.heightMm).toBe(wallConstruction(passage.walls[0]!).heightMm);
    const withWindow = addOpening(room, wall.id, { x: 2000, y: 0 }, 'ventana');
    const window = fillWallWithOpening(withWindow, withWindow.openings[0]!.id).openings[0]!;
    expect(openingConstruction(window).heightMm).toBe(openingConstruction(withWindow.openings[0]!).heightMm);
  });
});
