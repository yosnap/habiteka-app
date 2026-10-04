/**
 * Amueblar ponía la cocina con módulos y aparatos sueltos repartidos por la estancia, y una planta encima de la cama.
 * La cocina es ahora un tramo del mueble de cocina modular contra la pared y solo lo pequeño se apoya en un tablero bajo.
 */
import { describe, expect, it } from 'vitest';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { emptyEditorDocument, type EditorDocument } from '@/lib/editor-document/schema';
import { upgradeSpatialDocument } from '@/lib/editor-document/spatial-properties';
import { upgradeKitchenDocument } from '@/lib/editor-document/kitchen-run-commands';
import { getFurnitureCatalogEntry } from '@/lib/editor-document/furniture-catalog';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { roomWallFaces } from '@/lib/editor-document/room-wall-faces';
import { placeRunOnFace } from '@/lib/editor-document/proposal-coordinates';
import { kitchenSlots, KITCHEN_DEPTH_MM, planKitchen, type NativeDesignKitchen } from '@/lib/editor-document/native-design-kitchen';
import { addSuggestedKitchens, nativeFurniturePlacementIssue, settleNativeDesignFurniture } from '@/lib/editor-document/native-design-proposal';
import { slotSpan } from '@/lib/editor-document/kitchen-run-volumes';

// Cocina de 4000 × 3000 con muros de 150 mm: suelo útil de 75 a 3925 en x y de 75 a 2925 en y.
const room = () => upgradeKitchenDocument(upgradeSpatialDocument(addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 }], true)));
const put = (doc: EditorDocument, id: string, catalogId: string, x: number, y: number, rotation = 0) => {
  const entry = getFurnitureCatalogEntry(catalogId)!;
  doc.furniture.push({ id, kind: entry.kind, catalogId: entry.id, x, y, widthMm: entry.widthMm, depthMm: entry.depthMm, heightMm: entry.heightMm,
    elevationMm: 0, rotation, dimensionalOrigin: 'physical', color: entry.color });
};

describe('cocina de la propuesta', () => {
  it('encaja los aparatos en orden, juntos los que van juntos, y quita lo que no cabe', () => {
    const slots = kitchenSlots(3400, ['fregadero', 'lavavajillas', 'vitroceramica', 'horno'], { startMm: 650, endMm: 0 });
    const spans = slots.map(slotSpan);
    expect(slots.map((slot) => slot.kind)).toEqual(['fregadero', 'lavavajillas', 'vitroceramica', 'horno']);
    expect(spans[0]!.from).toBeGreaterThanOrEqual(650);
    expect(spans.at(-1)!.to).toBeLessThanOrEqual(3400);
    expect([spans[1]!.from - spans[0]!.to, spans[3]!.from - spans[2]!.to]).toEqual([0, 0]);
    spans.slice(1).forEach((span, index) => expect(span.from).toBeGreaterThanOrEqual(spans[index]!.to));
    expect(kitchenSlots(1500, ['fregadero', 'frigorifico-columna', 'vitroceramica']).map((slot) => slot.kind)).toEqual(['fregadero', 'vitroceramica']);
  });

  it('una cocina en L se pega a las dos paredes y deja libre la esquina compartida', () => {
    const doc = room(), [space] = deriveRooms(doc), faces = roomWallFaces(doc, space!, 'E1', []);
    const bottom = faces.find((face) => face.side === 'abajo')!, right = faces.find((face) => face.side === 'derecha')!;
    const kitchen = (face: typeof bottom, appliances: NativeDesignKitchen['appliances']): NativeDesignKitchen =>
      ({ ...placeRunOnFace(face, face.fromMm, face.toMm, KITCHEN_DEPTH_MM), lengthMm: face.toMm - face.fromMm, appliances, uppers: true, reason: '' });
    addSuggestedKitchens(doc, [kitchen(bottom, ['fregadero', 'lavavajillas', 'vitroceramica', 'horno']), kitchen(right, ['frigorifico-columna'])], deriveRooms(doc));
    expect(doc.kitchenRuns).toHaveLength(2);
    const [long, short] = doc.kitchenRuns!;
    // El brazo inferior va de la esquina derecha a la izquierda con la trasera en la cara del muro (y = 2925).
    expect([Math.round(long!.x), Math.round(long!.y), long!.rotation, long!.widthMm]).toEqual([3925, 2925, 180, 3850]);
    expect([Math.round(short!.x), Math.round(short!.y), short!.rotation]).toEqual([3925, 75, 90]);
    expect(Math.min(...long!.kitchen.slots.map((slot) => slotSpan(slot).from))).toBeGreaterThanOrEqual(KITCHEN_DEPTH_MM);
    expect(Math.max(...short!.kitchen.slots.map((slot) => slotSpan(slot).to))).toBeLessThanOrEqual(short!.widthMm - KITCHEN_DEPTH_MM);
    expect(long!.kitchen.uppers).toBeDefined();
  });

  it('monta la cocina en lineal si una pared da para todo y si no en L, aunque la IA prefiera la pared corta', () => {
    const doc = room(), [space] = deriveRooms(doc), faces = roomWallFaces(doc, space!, 'E1', []), extent = { x: 3850, y: 2850 };
    const left = faces.find((face) => face.side === 'izquierda')!;
    const all = ['fregadero', 'lavavajillas', 'vitroceramica', 'horno', 'frigorifico-columna'] as const;
    const plan = planKitchen(faces, extent, [...all], [left.id]);
    expect(plan).toHaveLength(2);
    expect(plan.flatMap((arm) => arm.appliances).sort()).toEqual([...all].sort());
    expect(plan[1]!.appliances.at(-1)).toBe('frigorifico-columna');
    const small = planKitchen(faces, extent, ['fregadero', 'vitroceramica'], [left.id]);
    expect(small.map(({ arm }) => arm.face.side)).toEqual(['izquierda']);
    // Sin 1 m de paso delante no hay cocina en esa pared.
    expect(planKitchen(faces, { x: 1500, y: 1500 }, [...all])).toEqual([]);
  });

  it('una planta no se apoya en la cama y la lámpara de mesa va a la mesilla', () => {
    const doc = room();
    put(doc, 'cama', 'habiteka:furniture:cama-doble', 1200, 75);
    put(doc, 'mesilla', 'habiteka:furniture:mesita', 2850, 75);
    expect(nativeFurniturePlacementIssue(doc, { catalogId: 'habiteka:furniture:planta', xMm: 1700, yMm: 900, rotation: 0, reason: '' })).toBe('collision');
    const lamp = { catalogId: 'habiteka:furniture:lampara-mesa', xMm: 1300, yMm: 200, rotation: 0, reason: '' };
    expect(nativeFurniturePlacementIssue(doc, lamp)).toBe('support');
    const settled = settleNativeDesignFurniture(doc, lamp);
    expect(settled.issue).toBeNull();
    // Centrada sobre la mesilla de 450 × 400.
    expect([Math.round(settled.item.xMm), Math.round(settled.item.yMm)]).toEqual([2925, 125]);
  });
});
