import { expect, it } from 'vitest';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { editorDesignContext } from '@/lib/editor-document/design-context';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addBuildingLevel } from '@/lib/editor-document/building-levels';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { upgradeSpatialDocument } from '@/lib/editor-document/spatial-properties';
import { setFloorFinish } from '@/lib/editor-document/floor-finishes';

it('entrega a la propuesta los acabados existentes de ambas caras y el estilo de la planta', () => {
  const doc = addWallPath(emptyEditorDocument(), [
    { x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 4000 }, { x: 0, y: 4000 },
  ], true);
  doc.designStyle = 'mediterraneo';
  doc.walls[0]!.materials = { left: 'polyhaven:wood_floor', right: 'plaster-white' };
  const context = editorDesignContext(doc);
  expect(context.designStyle).toBe('mediterraneo');
  expect(context.levels[0]!.designStyle).toBe('mediterraneo');
  expect(context.levels[0]!.walls[0]!.finishes).toEqual({
    left: { materialId: 'polyhaven:wood_floor', color: null },
    right: { materialId: 'plaster-white', color: null },
  });
  expect(doc.walls[0]!.colors).toBeUndefined();
});

it('resume la paleta guardada de otras plantas al diseñar una planta nueva', () => {
  const ground = upgradeSpatialDocument(addWallPath(emptyEditorDocument(), [
    { x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 4000 }, { x: 0, y: 4000 },
  ], true));
  const roomId = deriveRooms(ground)[0]!.id;
  ground.designStyle = 'moderno';
  ground.walls[0]!.materials = { left: 'polyhaven:wood_floor', right: 'plaster-white' };
  ground.schemaVersion = 5;
  ground.floorFinishes = [{ roomId, color: '#ffffff', texture: 'polyhaven:stone_tiles', tileSizeMm: 1000, rotation: 0 }];
  const upper = addBuildingLevel(ground);
  const context = editorDesignContext(upper);
  expect(context.designStyle).toBe('moderno');
  expect(context.existingMaterialPalette.walls).toContain('polyhaven:wood_floor');
  expect(context.existingMaterialPalette.floors).toContain('polyhaven:stone_tiles');
  expect(context.levels[0]!.designStyle).toBe('moderno');
  expect(upper.walls).toEqual([]);
});

it('entrega el material del canto elevado y lo reutiliza en la paleta del inmueble', () => {
  const shell = addWallPath(emptyEditorDocument(), [
    { x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 4000 }, { x: 0, y: 4000 },
  ], true);
  const roomId = deriveRooms(shell)[0]!.id;
  const doc = setFloorFinish(shell, roomId, { elevationMm: 1000,
    undersideTexture: 'polyhaven:brushed_concrete', undersideColor: '#ffffff' });
  const context = editorDesignContext(doc);
  expect(context.levels[0]!.floors[0]!.slabUnderside).toMatchObject({
    texture: 'polyhaven:brushed_concrete', color: '#ffffff',
  });
  expect(context.existingMaterialPalette.slabUndersides).toContain('polyhaven:brushed_concrete');
});
