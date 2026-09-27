import { describe, expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { addLuminaire, removeCeiling, setCeilingEdgeMaterialForAllRooms, setCeilingTopMaterialForAllRooms, setRoomCeiling, updateLuminaire } from '@/lib/editor-document/ceiling-commands';
import { ceilingSurfaces, ceilingWarnings, eligibleCeilingRooms, hasCompleteInteriorRoof, resolvedLuminaires } from '@/lib/editor-document/ceiling-geometry';
import { parseEditorDocument } from '@/lib/editor-document/validation';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { addBuildingLevel, buildingDocuments, switchBuildingLevel } from '@/lib/editor-document/building-levels';
import { setDesignSpaceKind } from '@/lib/editor-document/spatial-properties';
import { ceilingDesignContext } from '@/lib/editor-document/ceiling-design-context';
import { setFloorFinish } from '@/lib/editor-document/floor-finishes';
import { setWallConstruction } from '@/lib/editor-document/construction-commands';
import { applyCommand } from '@/lib/editor-document/commands';
import { roofSlabPlacement } from '@/components/editor-v2/scene/ceiling-scene-utils';

const room = () => addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 5000 }, { x: 0, y: 5000 }], true);
const ceiling = () => { const doc = room(); return setRoomCeiling(doc, deriveRooms(doc)[0]!.id); };

describe('contrato de techos y luminarias', () => {
  it('migra solo al editar, permite guardar/recargar y deshacer/rehacer sin mutar el original', () => {
    const doc = room(), original = structuredClone(doc), store = createEditorStore(doc);
    expect(ceilingSurfaces(doc)).toEqual([]);
    expect(parseEditorDocument(doc)).toEqual(original);
    const covered = setRoomCeiling(doc, deriveRooms(doc)[0]!.id);
    const lit = addLuminaire(covered, covered.ceilings![0]!.id, 'pendant', { x: 2000, y: 2000 });
    expect(doc).toEqual(original); expect(lit.schemaVersion).toBe(12);
    expect(parseEditorDocument(JSON.parse(JSON.stringify(lit)))).toEqual(lit);
    store.getState().apply(lit); store.getState().undo(); expect(store.getState().document).toEqual(doc);
    store.getState().redo(); expect(store.getState().document).toEqual(lit);
  });
  it('excluye patios etiquetados, perímetros exteriores sintéticos y espacios exteriores', () => {
    const doc = room(); doc.labels.push({ id: 'patio-label', x: 2500, y: 2500, text: 'Patio' });
    expect(eligibleCeilingRooms(doc)).toEqual([]);
    expect(() => setRoomCeiling(doc, deriveRooms(doc)[0]!.id)).toThrow('interior');
    const outdoor = room(); outdoor.walls[0]!.id = 'hidden:outdoor'; outdoor.walls[0]!.hidden = true;
    expect(eligibleCeilingRooms(outdoor)).toEqual([]);
    expect(eligibleCeilingRooms(setDesignSpaceKind(room(), 'patio'))).toEqual([]);
  });
  it('solo considera terminada una cubierta con todas las estancias interiores válidas', () => {
    expect(hasCompleteInteriorRoof(room())).toBe(false);
    const covered = ceiling();
    expect(hasCompleteInteriorRoof(covered)).toBe(true);
    expect(hasCompleteInteriorRoof(setDesignSpaceKind(room(), 'patio'))).toBe(false);
    expect(hasCompleteInteriorRoof(removeCeiling(covered, covered.ceilings![0]!.id))).toBe(false);
  });
  it('guarda un material exterior del techo separado del acabado interior', () => {
    const original = ceiling(), roomId = original.ceilings![0]!.roomId;
    const textured = setRoomCeiling(original, roomId, { topMaterialId: 'polyhaven:brushed_concrete_03' });
    expect(textured.ceilings![0]).toMatchObject({ color: '#f4f1e9', topMaterialId: 'polyhaven:brushed_concrete_03' });
    expect(ceilingDesignContext(textured).ceilings[0]?.topMaterialId).toBe('polyhaven:brushed_concrete_03');
    expect(parseEditorDocument(JSON.parse(JSON.stringify(textured)))).toEqual(textured);
    expect(setRoomCeiling(textured, roomId, { color: '#eeeeee' }).ceilings![0]!.topMaterialId)
      .toBe('polyhaven:brushed_concrete_03');
    expect(setRoomCeiling(textured, roomId, { topMaterialId: null }).ceilings![0]!.topMaterialId).toBeUndefined();
    expect(() => setRoomCeiling(original, roomId, { topMaterialId: 'material-inexistente' }))
      .toThrow('Material de la cara superior');
    expect(original.ceilings![0]!.topMaterialId).toBeUndefined();
  });
  it('mantiene la cubierta sobre los muros cuando baja un falso techo y conserva su espesor', () => {
    const base = ceiling(), roomId = base.ceilings![0]!.roomId;
    const originalRoof = roofSlabPlacement(ceilingSurfaces(base)[0]!);
    const lowered = setRoomCeiling(base, roomId, { kind: 'suspended', dropMm: 180, roofThicknessMm: 220 });
    const changedRoof = roofSlabPlacement(ceilingSurfaces(lowered)[0]!);
    expect(changedRoof.bottomM).toBe(originalRoof.bottomM);
    expect(changedRoof.topM).toBeCloseTo(originalRoof.bottomM + .22);
    expect(ceilingSurfaces(lowered)[0]!.heightMm).toBe(ceilingSurfaces(base)[0]!.heightMm - 180);
    expect(ceilingDesignContext(lowered).ceilings[0]?.roofTopM).toBeCloseTo(changedRoof.topM);
    expect(parseEditorDocument(JSON.parse(JSON.stringify(lowered)))).toEqual(lowered);
    expect(() => setRoomCeiling(base, roomId, { roofThicknessMm: 79 })).toThrow('Espesor de cubierta');
    expect(() => setRoomCeiling(base, roomId, { roofThicknessMm: 401 })).toThrow('Espesor de cubierta');
  });
  it('aplica material superior en bloque sin cambiar el falso techo ni las luces', () => {
    const base = ceiling(), first = base.ceilings![0]!;
    const suspended = setRoomCeiling(base, first.roomId, { kind: 'suspended', dropMm: 180, color: '#ccddee' });
    const original = addLuminaire(suspended, first.id, 'flush');
    const textured = setCeilingTopMaterialForAllRooms(original, 'polyhaven:brushed_concrete_03');
    expect(textured.ceilings![0]).toEqual({ ...original.ceilings![0], topMaterialId: 'polyhaven:brushed_concrete_03' });
    expect(textured.luminaires).toEqual(original.luminaires);
    expect(setCeilingTopMaterialForAllRooms(textured, null).ceilings).toEqual(original.ceilings);
    expect(original.ceilings![0]!.topMaterialId).toBeUndefined();
  });
  it('mantiene independiente el material PBR del canto exterior', () => {
    const original = ceiling(), roomId = original.ceilings![0]!.roomId;
    const top = setRoomCeiling(original, roomId, { topMaterialId: 'polyhaven:brushed_concrete_03' });
    const edge = setRoomCeiling(top, roomId, { edgeMaterialId: 'polyhaven:white_plaster_02' });
    expect(edge.ceilings![0]).toMatchObject({
      topMaterialId: 'polyhaven:brushed_concrete_03', edgeMaterialId: 'polyhaven:white_plaster_02',
    });
    expect(ceilingDesignContext(edge).ceilings[0]?.edgeMaterialId).toBe('polyhaven:white_plaster_02');
    expect(parseEditorDocument(JSON.parse(JSON.stringify(edge)))).toEqual(edge);
    const lit = addLuminaire(edge, edge.ceilings![0]!.id, 'flush');
    const cleared = setCeilingEdgeMaterialForAllRooms(lit, null);
    expect(cleared.ceilings![0]!.topMaterialId).toBe('polyhaven:brushed_concrete_03');
    expect(cleared.ceilings![0]!.edgeMaterialId).toBeUndefined();
    expect(cleared.luminaires).toEqual(lit.luminaires);
    expect(lit.ceilings![0]!.edgeMaterialId).toBe('polyhaven:white_plaster_02');
    expect(() => setRoomCeiling(top, roomId, { edgeMaterialId: 'material-inexistente' }))
      .toThrow('Material del canto');
  });
  it('adapta la altura de lámpara al techo y rechaza descensos incompatibles o focos sin cámara', () => {
    const doc = ceiling(), id = doc.ceilings![0]!.id, roomId = doc.ceilings![0]!.roomId;
    expect(() => addLuminaire(doc, id, 'recessed')).toThrow('falso techo');
    expect(() => setRoomCeiling(doc, roomId, { kind: 'suspended', dropMm: 79 })).toThrow();
    // El campo se escribe en centímetros: 70 cm pasa del tope y se rechaza por eso.
    expect(() => setRoomCeiling(doc, roomId, { kind: 'suspended', dropMm: 700 })).toThrow('centímetros');
    const lit = addLuminaire(doc, id, 'flush');
    const lowered = setRoomCeiling(lit, roomId, { kind: 'suspended', dropMm: 150 });
    expect(resolvedLuminaires(lowered)[0]!.heightMm).toBe(resolvedLuminaires(lit)[0]!.heightMm - 150);
    expect(lowered.luminaires).toEqual(lit.luminaires);
  });
  it('rechaza proximidad a muro, solapamiento, altura libre y objetos altos sin mutar el documento', () => {
    const doc = ceiling(), id = doc.ceilings![0]!.id;
    expect(() => addLuminaire(doc, id, 'flush', { x: 10, y: 2000 })).toThrow('muros');
    const lit = addLuminaire(doc, id, 'pendant', { x: 2500, y: 2500 }), original = structuredClone(lit);
    expect(() => addLuminaire(lit, id, 'flush', { x: 2600, y: 2500 })).toThrow('superpongan');
    expect(() => updateLuminaire(lit, lit.luminaires![0]!.id, { dropMm: 1000 })).toThrow('altura');
    expect(lit).toEqual(original);
    const blocked = ceiling(); blocked.furniture.push({ id: 'wardrobe', color: '#ffffff', kind: 'wardrobe', x: 2000, y: 2000, widthMm: 1000, depthMm: 1000, heightMm: 2600, elevationMm: 0, rotation: 0, dimensionalOrigin: 'physical' });
    expect(() => addLuminaire(blocked, blocked.ceilings![0]!.id, 'flush', { x: 2500, y: 2500 })).toThrow('elemento alto');
  });
  it('mide altura libre desde suelo elevado y colisiones con muebles girados', () => {
    const doc = ceiling(), id = doc.ceilings![0]!.id;
    // Subir el suelo alarga los muros para conservar la altura libre; se devuelven a 2,70 m para simular un techo bajo.
    let raised = setFloorFinish(doc, doc.ceilings![0]!.roomId, { elevationMm: 500 });
    for (const wall of raised.walls) raised = setWallConstruction(raised, wall.id, { heightMm: 2700 } as Parameters<typeof setWallConstruction>[2]);
    expect(() => addLuminaire(raised, id, 'pendant', { x: 2500, y: 2500 })).toThrow('altura');
    expect(() => addLuminaire(raised, id, 'flush', { x: 2500, y: 2500 })).not.toThrow();
    doc.furniture.push({ id: 'rotated', kind: 'wardrobe', color: '#ffffff', x: 3000, y: 1000, widthMm: 2000, depthMm: 600, heightMm: 2600, elevationMm: 0, rotation: 90, dimensionalOrigin: 'physical' });
    expect(() => addLuminaire(doc, id, 'flush', { x: 2700, y: 2000 })).toThrow('elemento alto');
    expect(() => addLuminaire(doc, id, 'flush', { x: 4000, y: 1300 })).not.toThrow();
  });
  it('rechaza datos no finitos, parámetros fuera de rango e IDs duplicados', () => {
    const doc = ceiling(), lit = addLuminaire(doc, doc.ceilings![0]!.id, 'flush');
    for (const patch of [{ x: NaN }, { y: Infinity }, { lumens: 0 }, { temperatureK: 7000 }]) {
      expect(() => updateLuminaire(lit, lit.luminaires![0]!.id, patch)).toThrow();
    }
    const duplicate = structuredClone(lit); duplicate.luminaires![0]!.id = duplicate.ceilings![0]!.id;
    expect(() => parseEditorDocument(duplicate)).toThrow('duplicado');
  });
  it('elimina lámparas con su techo y advierte cuando pierde el cerramiento', () => {
    const doc = ceiling(), lit = addLuminaire(doc, doc.ceilings![0]!.id, 'flush');
    const removed = removeCeiling(lit, lit.ceilings![0]!.id);
    expect(removed.ceilings).toEqual([]); expect(removed.luminaires).toEqual([]);
    const broken = structuredClone(lit); broken.walls.pop();
    expect(ceilingWarnings(broken).length).toBeGreaterThan(0); expect(resolvedLuminaires(broken)).toEqual([]);
  });
  it('conserva techos y luminarias al partir un muro y al cambiar el tipo de espacio', () => {
    const doc = ceiling(), lit = addLuminaire(doc, doc.ceilings![0]!.id, 'flush');
    const split = applyCommand(lit, { type: 'split-wall', wallId: lit.walls[0]!.id, position: .5, vertexId: 'split-v', newWallId: 'split-w' });
    expect(ceilingSurfaces(split)).toHaveLength(1); expect(resolvedLuminaires(split)).toHaveLength(1);
    const changed = setDesignSpaceKind(lit, 'interior');
    expect(changed.schemaVersion).toBe(12); expect(changed.luminaires).toEqual(lit.luminaires);
  });
  it('recalibra XY de luminarias sin escalar descenso, caída ni alturas físicas', () => {
    const doc = ceiling(); doc.calibration = { mmPerPixel: 10 };
    const lit = addLuminaire(doc, doc.ceilings![0]!.id, 'pendant', { x: 2000, y: 2500 });
    const scaled = applyCommand(lit, { type: 'recalibrate', factor: 2 });
    expect(scaled.luminaires![0]).toEqual({ ...lit.luminaires![0], x: 4000, y: 5000 });
    expect(scaled.ceilings![0]!.dropMm).toBe(lit.ceilings![0]!.dropMm);
    expect(resolvedLuminaires(scaled)[0]!.heightMm).toBe(resolvedLuminaires(lit)[0]!.heightMm);
    expect(scaled.walls.map((wall) => wall.heightMm)).toEqual(lit.walls.map((wall) => wall.heightMm));
  });
  it('respeta altura de planta en vista activa, proyección multiplanta y prompts', () => {
    const doc = ceiling(); doc.walls.forEach((wall) => { wall.heightMm = 3500; });
    doc.activeLevelId = 'ground'; doc.levels = [{ id: 'ground', name: 'Baja', heightMm: 2700 }];
    const lit = addLuminaire(doc, doc.ceilings![0]!.id, 'flush');
    const projected = buildingDocuments(lit)[0]!.document;
    expect(ceilingSurfaces(lit)[0]!.heightMm).toBe(2700);
    expect(ceilingSurfaces(projected)[0]!.heightMm).toBe(2700);
    expect(ceilingDesignContext(projected)).toEqual(ceilingDesignContext(lit));
    expect(ceilingDesignContext(projected).ceilings[0]!.heightM).toBe(2.7);
    expect(parseEditorDocument(projected)).toEqual(projected);
  });
  it('avisa al dividir una habitación y no asigna el techo a una mitad arbitraria', () => {
    const doc = ceiling(), lit = addLuminaire(doc, doc.ceilings![0]!.id, 'flush');
    const top = applyCommand(lit, { type: 'split-wall', wallId: lit.walls[0]!.id, position: .5, vertexId: 'top-mid', newWallId: 'top-half' });
    const bottom = applyCommand(top, { type: 'split-wall', wallId: lit.walls[2]!.id, position: .5, vertexId: 'bottom-mid', newWallId: 'bottom-half' });
    const divided = addWallPath(bottom, [{ x: 2500, y: 0 }, { x: 2500, y: 5000 }]);
    const store = createEditorStore(bottom); store.getState().apply(divided);
    const current = store.getState().document;
    expect(deriveRooms(current)).toHaveLength(2);
    expect(current.ceilings![0]!.roomId).toBe(bottom.ceilings![0]!.roomId);
    expect(current.luminaires).toEqual(lit.luminaires);
    expect(ceilingWarnings(current).length).toBeGreaterThan(0);
    expect(ceilingSurfaces(current)).toEqual([]);
  });
  it('conserva la versión de esquema y el contenido al crear, copiar y cambiar plantas', () => {
    const doc = ceiling(), lit = addLuminaire(doc, doc.ceilings![0]!.id, 'flush');
    for (const copy of [false, true]) {
      const upper = addBuildingLevel(lit, copy);
      expect(upper.schemaVersion).toBe(12);
      expect(upper.ceilings).toHaveLength(copy ? 1 : 0);
      const ground = switchBuildingLevel(upper, upper.levels![0]!.id);
      expect(ground.schemaVersion).toBe(12); expect(ground.luminaires).toEqual(lit.luminaires);
      expect(parseEditorDocument(JSON.parse(JSON.stringify(ground)))).toEqual(ground);
    }
  });
});
