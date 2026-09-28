import { expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { applyNativeDesignProposal, canPlaceNativeDesignFurniture, type NativeDesignProposal } from '@/lib/editor-document/native-design-proposal';
import { editorDocumentToScene } from '@/canvas/editor-v2/scene/editor-document-to-scene';
import { addOutdoorArea } from '@/lib/editor-document/outdoor-area';
import { eligibleCeilingRooms } from '@/lib/editor-document/ceiling-geometry';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { floorFinish, setFloorFinish } from '@/lib/editor-document/floor-finishes';
import { parseEditorDocument } from '@/lib/editor-document/validation';
import { upgradeRampDocument, upgradeSpatialDocument } from '@/lib/editor-document/spatial-properties';
import { insideRoom } from '@/lib/editor-document/ceiling-geometry';
import { addBuildingLevel } from '@/lib/editor-document/building-levels';
import { buildingDesignStyle } from '@/lib/editor-document/design-scope';
import { addDesignZone, reshapeDesignZone } from '@/lib/editor-document/design-zone-commands';

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

it('compone dos diseños dentro de una misma estancia sin sustituir el suelo de la otra zona', () => {
  const room = addWallPath(emptyEditorDocument(),
    [{ x: 0, y: 0 }, { x: 8000, y: 0 }, { x: 8000, y: 4000 }, { x: 0, y: 4000 }], true);
  const salon = addDesignZone(room, 'Salón',
    [{ x: 200, y: 200 }, { x: 3900, y: 200 }, { x: 3900, y: 3800 }, { x: 200, y: 3800 }]);
  const cocina = addDesignZone(salon, 'Cocina',
    [{ x: 3900, y: 200 }, { x: 7800, y: 200 }, { x: 7800, y: 3800 }, { x: 3900, y: 3800 }]);
  const [salonId, cocinaId] = cocina.designZones!.map((zone) => zone.id);
  const first = applyNativeDesignProposal(cocina, { ...proposal, scope: { kind: 'zone', zoneId: salonId!, roomIds: [] } });
  const second = applyNativeDesignProposal(first, { ...proposal,
    scope: { kind: 'zone', zoneId: cocinaId!, roomIds: [] },
    materials: { ...proposal.materials, floors: 'polyhaven:square_tiles_03' } });
  const roomId = deriveRooms(second)[0]!.id;
  expect(floorFinish(second, roomId)).toEqual(floorFinish(cocina, roomId));
  expect(second.designZones?.map((zone) => zone.floorFinish?.texture))
    .toEqual(['polyhaven:wood_floor', 'polyhaven:square_tiles_03']);
  expect(second.vertices).toEqual(cocina.vertices);
  expect(second.walls).toEqual(cocina.walls);
  const sofa = { catalogId: 'habiteka:furniture:sofa-exterior', xMm: 1000, yMm: 1000, rotation: 0, reason: 'Asiento' };
  expect(canPlaceNativeDesignFurniture(second, sofa, deriveRooms(second), new Set([roomId]), second.designZones![0]!.polygon)).toBe(true);
  expect(canPlaceNativeDesignFurniture(second, { ...sofa, xMm: 3000 }, deriveRooms(second),
    new Set([roomId]), second.designZones![0]!.polygon)).toBe(false);
  const patches = editorDocumentToScene(second).polygons.filter((polygon) => polygon.id.startsWith(salonId!) || polygon.id.startsWith(cocinaId!));
  expect(patches.some((polygon) => polygon.id.startsWith(salonId!) && polygon.floorFinish?.texture === 'polyhaven:wood_floor')).toBe(true);
  expect(patches.some((polygon) => polygon.id.startsWith(cocinaId!) && polygon.floorFinish?.texture === 'polyhaven:square_tiles_03')).toBe(true);
  expect(patches.every((polygon) => polygon.height === 0)).toBe(true);
  expect(parseEditorDocument(JSON.parse(JSON.stringify(second))).designZones).toEqual(second.designZones);
  const reshaped = reshapeDesignZone(second, salonId!,
    [{ x: 300, y: 300 }, { x: 3800, y: 300 }, { x: 3800, y: 3700 }, { x: 300, y: 3700 }]);
  expect(reshaped.designZones?.[0]?.floorFinish).toEqual(second.designZones?.[0]?.floorFinish);
  expect(reshaped.designZones?.[1]).toEqual(second.designZones?.[1]);
  expect(() => reshapeDesignZone(second, salonId!,
    [{ x: 200, y: 200 }, { x: 5000, y: 200 }, { x: 5000, y: 3800 }, { x: 200, y: 3800 }])).toThrow('superpone');
  expect(() => addDesignZone(second, 'Solapada',
    [{ x: 3000, y: 300 }, { x: 5000, y: 300 }, { x: 5000, y: 3000 }, { x: 3000, y: 3000 }])).toThrow('superpone');
  expect(() => applyNativeDesignProposal(second, { ...proposal, scope: { kind: 'zone', zoneId: 'ausente', roomIds: [] } }))
    .toThrow('ya no existe');
});

it('permite diseñar una escalera de entrada exterior aunque no esté en una estancia', () => {
  const room = upgradeSpatialDocument(addWallPath(emptyEditorDocument(),
    [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 4000 }, { x: 0, y: 4000 }], true));
  room.stairs = [{ id: 'entrada-escalera', kind: 'straight', catalogId: 'builtin:stair-straight',
    x: 4500, y: 500, widthMm: 1000, depthMm: 2000, heightMm: 1000, elevationMm: 0,
    rotation: 0, stepCount: 6, materialId: 'wood-oak', color: '#b58b59' }];
  const marked = addDesignZone(room, 'Entrada',
    [{ x: 4300, y: 300 }, { x: 5700, y: 300 }, { x: 5700, y: 2700 }, { x: 4300, y: 2700 }]);
  const next = applyNativeDesignProposal(marked, { ...proposal,
    scope: { kind: 'zone', zoneId: marked.designZones![0]!.id, roomIds: [] } });
  expect(next.stairs?.[0]?.materialId).toBe('polyhaven:wood_floor');
  expect(next.designZones?.[0]?.floorFinish).toBeUndefined();
  expect(floorFinish(next, deriveRooms(next)[0]!.id)).toEqual(floorFinish(marked, deriveRooms(marked)[0]!.id));
});

it('aplica el canto propuesto solo a forjados elevados del ámbito exterior', () => {
  const house = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 4000 }, { x: 0, y: 4000 }], true);
  const joined = addOutdoorArea(house, { x: 4000, y: 0 }, { x: 7000, y: 4000 });
  const interior = eligibleCeilingRooms(joined)[0]!.id;
  const terrace = deriveRooms(joined).find((room) => room.id !== interior)!.id;
  const source = setFloorFinish(setFloorFinish(joined, interior, { elevationMm: 900,
    undersideTexture: 'polyhaven:wood_floor' }), terrace, { elevationMm: 1000 });
  const next = applyNativeDesignProposal(source, { ...proposal, scope: { kind: 'exterior', roomIds: [] },
    materials: { ...proposal.materials, slabUndersides: 'polyhaven:brushed_concrete' } });
  expect(floorFinish(next, terrace)).toMatchObject({ undersideTexture: 'polyhaven:brushed_concrete', undersideColor: '#ffffff' });
  expect(floorFinish(next, interior).undersideTexture).toBe('polyhaven:wood_floor');
  expect(floorFinish(source, terrace).undersideTexture).toBeUndefined();
});

it('limita los acabados a la terraza y piezas exteriores elegidas, incluidos los descansillos', () => {
  const house = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 4000 }, { x: 0, y: 4000 }], true);
  const withTerrace = addOutdoorArea(house, { x: 4000, y: 0 }, { x: 7000, y: 4000 });
  const doc = upgradeRampDocument(addOutdoorArea(withTerrace, { x: -3000, y: 0 }, { x: 0, y: 4000 }));
  doc.stairs = [
    { id: 'stair-target', kind: 'straight', catalogId: 'builtin:stair-straight', x: 7200, y: 1000,
      widthMm: 1000, depthMm: 2000, heightMm: 1000, elevationMm: 0, rotation: 0, stepCount: 6, materialId: 'wood-oak', color: '#b58b59' },
    { id: 'stair-other', kind: 'straight', catalogId: 'builtin:stair-straight', x: -4200, y: 1000,
      widthMm: 1000, depthMm: 2000, heightMm: 1000, elevationMm: 0, rotation: 0, stepCount: 6, materialId: 'wood-oak', color: '#b58b59' },
  ];
  doc.ramps = [
    { id: 'ramp-target', catalogId: 'builtin:ramp-straight', x: 7200, y: 3500, widthMm: 1000,
      depthMm: 2000, riseMm: 500, elevationMm: 0, rotation: 0, materialId: 'concrete-grey', color: '#a6a6a0' },
    { id: 'landing-target', catalogId: 'builtin:ramp-landing', x: 7200, y: 5700, widthMm: 1000,
      depthMm: 1000, riseMm: 0, elevationMm: 500, rotation: 0, materialId: 'concrete-grey', color: '#a6a6a0' },
    { id: 'landing-other', catalogId: 'builtin:ramp-landing', x: -4200, y: 5700, widthMm: 1000,
      depthMm: 1000, riseMm: 0, elevationMm: 500, rotation: 0, materialId: 'concrete-grey',
      bodyMaterialId: 'polyhaven:wood_floor', color: '#a6a6a0' },
  ];
  const rooms = deriveRooms(doc);
  const terrace = rooms.find((room) => insideRoom({ x: 5500, y: 2000 }, room.boundary))!;
  const other = rooms.find((room) => insideRoom({ x: -1500, y: 2000 }, room.boundary))!;
  const next = applyNativeDesignProposal(doc, {
    ...proposal, scope: { kind: 'rooms', roomIds: [terrace.id],
      structureIds: ['stair-target', 'ramp-target', 'landing-target'] },
    materials: { ...proposal.materials, stairBodies: 'polyhaven:white_plaster_02',
      rampBodies: 'polyhaven:brushed_concrete', landingBodies: 'polyhaven:white_plaster_02' },
  }, { walls: false, floors: true, stairs: true, ramps: true, columns: false, furniture: [] });
  expect(floorFinish(next, terrace.id).texture).toBe('polyhaven:wood_floor');
  expect(floorFinish(next, other.id)).toEqual(floorFinish(doc, other.id));
  expect(next.stairs?.map((item) => item.materialId)).toEqual(['polyhaven:wood_floor', 'wood-oak']);
  expect(next.stairs?.map((item) => item.bodyMaterialId)).toEqual(['polyhaven:white_plaster_02', undefined]);
  expect(next.ramps?.map((item) => item.materialId)).toEqual(['polyhaven:wood_floor', 'polyhaven:wood_floor', 'concrete-grey']);
  expect(next.ramps?.map((item) => item.bodyMaterialId)).toEqual(['polyhaven:brushed_concrete', 'polyhaven:white_plaster_02', 'polyhaven:wood_floor']);
  expect(next.walls).toEqual(doc.walls);
  expect(() => applyNativeDesignProposal(doc, { ...proposal, scope: { kind: 'rooms', roomIds: [terrace.id], structureIds: ['missing'] } }))
    .toThrow('ya no coincide');
});

it('admite muebles y luces bajo una carpa sin atravesar postes ni objetos existentes', () => {
  const doc = upgradeSpatialDocument(addWallPath(emptyEditorDocument(),
    [{ x: 0, y: 0 }, { x: 6000, y: 0 }, { x: 6000, y: 4000 }, { x: 0, y: 4000 }], true));
  doc.furniture.push({ id: 'cover', kind: 'carpa', catalogId: 'habiteka:outdoor:carpa',
    x: 1000, y: 500, widthMm: 4000, depthMm: 3000, heightMm: 2800, elevationMm: 0,
    rotation: 0, dimensionalOrigin: 'physical', color: '#e9e4d8' });
  const sofa = { catalogId: 'habiteka:furniture:sofa-exterior', xMm: 1500, yMm: 1100, rotation: 0, reason: 'Asiento' };
  const led = { catalogId: 'habiteka:outdoor:tira-led', xMm: 1800, yMm: 2600, rotation: 0, reason: 'Luz cálida' };
  expect(canPlaceNativeDesignFurniture(doc, sofa)).toBe(true);
  expect(canPlaceNativeDesignFurniture(doc, led)).toBe(true);
  expect(canPlaceNativeDesignFurniture(doc, { ...sofa, xMm: 1050, yMm: 550 })).toBe(false);
  const withSofa = applyNativeDesignProposal(doc, { ...proposal, furniture: [sofa, led] },
    { walls: false, floors: false, stairs: false, ramps: false, columns: false, furniture: [0, 1] });
  expect(withSofa.furniture.map((item) => item.catalogId)).toContain('habiteka:furniture:sofa-exterior');
  expect(withSofa.furniture.map((item) => item.catalogId)).toContain('habiteka:outdoor:tira-led');
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

it('hereda el estilo de otra planta antes de aplicar una propuesta parcial', () => {
  const ground = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 4000 }, { x: 0, y: 4000 }], true);
  const styled = applyNativeDesignProposal(ground, { ...proposal, scope: { kind: 'interior', roomIds: [] } });
  const upper = addWallPath(addBuildingLevel(styled),
    [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 4000 }, { x: 0, y: 4000 }], true);
  expect(upper.designStyle).toBeUndefined();
  expect(buildingDesignStyle(upper)).toBe('moderno');
  expect(() => applyNativeDesignProposal(upper, { ...proposal, style: 'clasico', scope: { kind: 'interior', roomIds: [] } }))
    .toThrow('ya tiene otro estilo');
  expect(applyNativeDesignProposal(upper, { ...proposal, scope: { kind: 'interior', roomIds: [] } }).designStyle)
    .toBe('moderno');
});
