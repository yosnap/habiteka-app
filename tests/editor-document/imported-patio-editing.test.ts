import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildPlanImport } from '@/server/plan/build-plan-import';
import type { RawSketch } from '@/server/ai/sketch/sketch-types';
import type { DetectedWalls } from '@/server/plan/detect-walls-raster';
import { fromPlanImport } from '@/lib/editor-document/adapters/plano2d-import';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { assertEditorDocument, parseEditorDocument } from '@/lib/editor-document/validation';
import { wallPoints } from '@/lib/editor-document/geometry';
import { moveEntity } from '@/canvas/editor-v2/editing-operations';
import { previewVertex } from '@/canvas/editor-v2/vertex-preview';
import { applyCommand } from '@/lib/editor-document/commands';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { constrainExteriorVertex } from '@/lib/editor-document/exterior-vertex-constraint';

function house() {
  const { raw, detected } = JSON.parse(readFileSync(
    'tests/fixtures/plans/plano-nuestra-casa-flare-tecnico.raw.json', 'utf8',
  )) as { raw: RawSketch; detected: DetectedWalls };
  // Esta prueba ejercita la edición de puertas ya confirmadas, no su detección.
  raw.aberturas = raw.aberturas.map((opening) => opening.tipo === 'puerta'
    ? { ...opening, arcVisible: true } : opening);
  const result = buildPlanImport(raw, { includeFurniture: false, normalize: {
    wallsOverride: detected.walls, imageHeightOverWidth: detected.heightOverWidth,
  } });
  const converted = fromPlanImport(result);
  expect(converted.issues).toEqual([]);
  expect(converted.document).not.toBeNull();
  return converted.document!;
}

describe('edición del patio importado de Nuestra casa', () => {
  it('importa las puertas respaldadas por muros con sentido de apertura y permite guardar el documento', () => {
    const doc = house();
    const doors = doc.openings.filter((opening) => opening.kind === 'puerta');
    expect(doors.length).toBeGreaterThan(0);
    expect(doors.every((door) => doc.walls.some((wall) => wall.id === door.wallId))).toBe(true);
    expect(doors.every((door) => door.swing === 'left' || door.swing === 'right')).toBe(true);
    expect(parseEditorDocument(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
  });

  it('mueve el comedor manteniendo la línea exterior, el suelo y deshacer/rehacer', () => {
    const doc = house();
    const original = structuredClone(doc);
    const originalBoundary = wallPoints(doc, doc.walls.find((wall) => wall.id === 'hidden:z3:1')!);
    const originalDiningWall = wallPoints(doc, doc.walls.find((wall) => wall.id === 'w13')!);
    const next = moveEntity(doc, 'w13', { x: 250, y: 200 });
    const boundary = next.walls.find((wall) => wall.id === 'hidden:z3:1')!;
    const [a, b] = wallPoints(next, boundary);
    expect(a).toMatchObject({ x: originalBoundary[0]!.x, y: originalBoundary[0]!.y });
    expect(b).toMatchObject({ x: originalBoundary[1]!.x, y: originalBoundary[1]!.y + 200 });
    expect(wallPoints(next, next.walls.find((wall) => wall.id === 'w13')!)[0])
      .toMatchObject({ x: originalDiningWall[0]!.x + 250, y: originalDiningWall[0]!.y + 200 });
    expect(deriveRooms(next)).toHaveLength(deriveRooms(doc).length);
    expect(next.floorFinishes).toEqual(doc.floorFinishes);
    expect(deriveRooms(next).some((room) => room.id === next.floorFinishes![0]!.roomId)).toBe(true);
    expect(() => assertEditorDocument(next)).not.toThrow();
    expect(doc).toEqual(original);
    const store = createEditorStore(doc);
    store.getState().apply(next);
    store.getState().undo();
    expect(store.getState().document).toEqual(doc);
    store.getState().redo();
    expect(store.getState().document).toEqual(next);
  });

  it('aplica la misma restricción al vértice en la previsualización y el comando', () => {
    const doc = house();
    const boundary = wallPoints(doc, doc.walls.find((wall) => wall.id === 'hidden:z3:1')!);
    const point = { x: boundary[1]!.x + 250, y: boundary[1]!.y + 200 };
    const preview = previewVertex(doc, 'vertex:23', point, 0.1, false);
    expect(preview.error).toBeNull();
    expect(preview.point).toEqual({ x: boundary[1]!.x, y: boundary[1]!.y + 200 });
    expect(applyCommand(doc, { type: 'move-vertex', vertexId: 'vertex:23', ...point }))
      .toEqual(preview.document);
  });

  it('fija la esquina exterior y no restringe paredes ocultadas manualmente', () => {
    const doc = house();
    const fixed = doc.vertices.find((vertex) => vertex.id === 'vertex:25')!;
    expect(constrainExteriorVertex(doc, 'vertex:25', { x: 15000, y: 2000 }))
      .toEqual({ x: fixed.x, y: fixed.y });
    doc.walls.filter((wall) => wall.hidden).forEach((wall) => { wall.id = `manual:${wall.id}`; });
    expect(constrainExteriorVertex(doc, 'vertex:23', { x: 15000, y: 5500 }))
      .toEqual({ x: 15000, y: 5500 });
  });
});
