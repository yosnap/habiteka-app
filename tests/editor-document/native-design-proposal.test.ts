import { expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { applyNativeDesignProposal, type NativeDesignProposal } from '@/lib/editor-document/native-design-proposal';
import { editorDocumentToScene } from '@/canvas/editor-v2/scene/editor-document-to-scene';
import { addOutdoorArea } from '@/lib/editor-document/outdoor-area';
import { eligibleCeilingRooms } from '@/lib/editor-document/ceiling-geometry';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { floorFinish } from '@/lib/editor-document/floor-finishes';
import { parseEditorDocument } from '@/lib/editor-document/validation';

const proposal: NativeDesignProposal = { style: 'moderno', summary: 'Madera', furniture: [],
  materials: { walls: 'polyhaven:wood_floor', floors: 'polyhaven:wood_floor', stairs: 'polyhaven:wood_floor',
    ramps: 'polyhaven:wood_floor', columns: 'polyhaven:wood_floor' } };
it('aplica a un plano antiguo, actualiza la escena 3D y permite deshacer', () => {
  const source = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 6000, y: 0 }, { x: 6000, y: 4000 }, { x: 0, y: 4000 }], true);
  const store = createEditorStore(source);
  store.getState().apply(applyNativeDesignProposal(source, proposal));
  const next = store.getState().document;
  expect(next.schemaVersion).toBeGreaterThanOrEqual(5);
  expect(next.designStyle).toBe('moderno');
  expect(next.walls[0]?.materials?.left).toBe('polyhaven:wood_floor');
  expect(next.vertices).toEqual(source.vertices);
  expect(editorDocumentToScene(next).polygons.find(p => p.role === 'floor')?.floorFinish?.texture).toBe('polyhaven:wood_floor');
  expect(store.getState().sequence).toBe(1);
  store.getState().undo(); expect(store.getState().document).toEqual(source);
});

it('compone diseños interior y exterior en una escena sin sobrescribir el suelo ni la cara opuesta de la fachada', () => {
  const house = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 4000 }, { x: 0, y: 4000 }], true);
  const source = addOutdoorArea(house, { x: 4000, y: 0 }, { x: 7000, y: 4000 });
  const interior = eligibleCeilingRooms(source)[0]!;
  const exterior = deriveRooms(source).find((room) => room.id !== interior.id)!;
  const inside = applyNativeDesignProposal(source, { ...proposal, scope: { kind: 'interior', roomIds: [] } });
  expect(floorFinish(inside, interior.id).texture).toBe('polyhaven:wood_floor');
  expect(floorFinish(inside, exterior.id).texture).toBe(floorFinish(source, exterior.id).texture);

  const outside = applyNativeDesignProposal(inside, { ...proposal, scope: { kind: 'exterior', roomIds: [] },
    materials: { ...proposal.materials, walls: 'polyhaven:brushed_concrete', floors: 'polyhaven:square_tiles_03' } });
  expect(floorFinish(outside, interior.id).texture).toBe('polyhaven:wood_floor');
  expect(floorFinish(outside, exterior.id).texture).toBe('polyhaven:square_tiles_03');
  const facade = outside.walls.find((wall) => interior.wallIds.includes(wall.id) && !exterior.wallIds.includes(wall.id))!;
  expect(Object.values(facade.materials!)).toContain('polyhaven:wood_floor');
  expect(Object.values(facade.materials!)).toContain('polyhaven:brushed_concrete');
  expect(outside.vertices).toEqual(source.vertices);
});

it('rechaza una zona obsoleta antes de modificar el documento', () => {
  const source = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 4000 }, { x: 0, y: 4000 }], true);
  expect(() => applyNativeDesignProposal(source, { ...proposal, scope: { kind: 'rooms', roomIds: ['room:obsolete'] } }))
    .toThrow('ya no coincide');
  expect(() => applyNativeDesignProposal(source, { ...proposal, sourceRevision: source.revision + 1 }))
    .toThrow('El plano cambió');
});

it('aplica una propuesta solo a la estancia elegida', () => {
  const house = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 4000 }, { x: 0, y: 4000 }], true);
  const source = addOutdoorArea(house, { x: 4000, y: 0 }, { x: 7000, y: 4000 });
  const roomId = eligibleCeilingRooms(source)[0]!.id;
  const patioId = deriveRooms(source).find((room) => room.id !== roomId)!.id;
  const next = applyNativeDesignProposal(source, { ...proposal, scope: { kind: 'rooms', roomIds: [roomId] } });
  expect(floorFinish(next, roomId).texture).toBe('polyhaven:wood_floor');
  expect(floorFinish(next, patioId)).toEqual(floorFinish(source, patioId));
});

it('mantiene un estilo común entre ámbitos y permite sustituirlo al rediseñar toda la planta', () => {
  const source = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 4000 }, { x: 0, y: 4000 }], true);
  const first = applyNativeDesignProposal(source, { ...proposal, scope: { kind: 'interior', roomIds: [] } });
  expect(() => applyNativeDesignProposal(first, { ...proposal, style: 'clasico', scope: { kind: 'interior', roomIds: [] } }))
    .toThrow('ya tiene otro estilo');
  expect(applyNativeDesignProposal(first, { ...proposal, style: 'clasico', scope: { kind: 'all', roomIds: [] } }).designStyle)
    .toBe('clasico');
  expect(parseEditorDocument(JSON.parse(JSON.stringify(first))).designStyle).toBe('moderno');
  expect(() => parseEditorDocument({ ...first, designStyle: 'inventado' })).toThrow('Estilo de diseño desconocido');
});
