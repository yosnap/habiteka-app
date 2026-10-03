import { expect, it } from 'vitest';
import { duplicatePlanElement } from '@/canvas/editor-v2/duplicate-plan-element';
import { addWallPath, addOpening } from '@/canvas/editor-v2/editing-operations';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { visualSampleDocument } from '@/app/dev/editor-v2/visual-sample';
import { addTerrainSurface, suggestedTerrainSurface } from '@/lib/editor-document/terrain-surfaces';

it('duplica una pared con sus huecos sin compartir vértices ni mover el original', () => {
  let doc = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 4000, y: 0 }]);
  doc = addOpening(doc, doc.walls[0]!.id, { x: 2000, y: 0 }, 'puerta');
  const snapshot = structuredClone(doc), wall = doc.walls[0]!;
  const copy = duplicatePlanElement(doc, wall.id, { x: 0, y: 2000 });
  expect(doc).toEqual(snapshot); expect(copy.document.walls).toHaveLength(2);
  const duplicate = copy.document.walls.find(item => item.id === copy.id)!;
  expect(duplicate.startVertexId).not.toBe(wall.startVertexId);
  expect(copy.document.vertices.find(vertex => vertex.id === duplicate.startVertexId)).toMatchObject({ x: 0, y: 2000 });
  expect(copy.document.openings.find(opening => opening.wallId === copy.id)).toMatchObject({ widthMm: doc.openings[0]!.widthMm });
  expect(new Set(copy.document.openings.map(opening => opening.id)).size).toBe(2);
});
it('duplica un objeto y conserva el original sin mutar su documento', () => {
  const doc = visualSampleDocument(), original = doc.furniture.find(item => item.id === 'wardrobe')!;
  const copy = duplicatePlanElement(doc, original.id, { x: 3000, y: 0 });
  expect(copy.document.furniture.find(item => item.id === original.id)).toEqual(original);
  expect(copy.document.furniture.find(item => item.id === copy.id)).toMatchObject({ x: original.x + 3000, y: original.y });
  expect(copy.document.furniture).toHaveLength(doc.furniture.length + 1);
});
it('duplica terreno con acabado y dimensiones independientes', () => {
  const surface = suggestedTerrainSurface(emptyEditorDocument(), 'paving');
  const doc = addTerrainSurface(emptyEditorDocument(), surface);
  const copy = duplicatePlanElement(doc, surface.id, { x: 6000, y: 0 });
  expect(copy.document.terrainSurfaces).toHaveLength(2);
  expect(copy.document.terrainSurfaces?.find(item => item.id === surface.id)).toEqual(surface);
  expect(copy.document.terrainSurfaces?.find(item => item.id === copy.id)).toMatchObject({
    x: surface.x + 6000, y: surface.y, widthMm: surface.widthMm, texture: surface.texture,
  });
});
