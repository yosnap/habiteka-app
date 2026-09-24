import { describe, expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { setWallConstruction } from '@/lib/editor-document/construction-commands';
import {
  ceilingDropMm,
  MAX_CEILING_DROP_MM,
  MIN_CEILING_DROP_MM,
  setCeilingsForAllRooms,
  setRoomCeiling,
} from '@/lib/editor-document/ceiling-commands';

/** Estancia de muros bajos (2,50 m), donde el descenso máximo ya no cabe. */
const room = () => {
  const doc = addWallPath(emptyEditorDocument(), [
    { x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 4000 }, { x: 0, y: 4000 },
  ], true);
  return doc.walls.reduce((next, wall) => setWallConstruction(next, wall.id, { heightMm: 2500 }), doc);
};

describe('descenso del falso techo en centímetros', () => {
  it('acota lo tecleado al rango admitido, sin dejar pasar los 150 «cm» de quien pensaba en milímetros', () => {
    expect(ceilingDropMm(15)).toBe(150);
    expect(ceilingDropMm(150)).toBe(MAX_CEILING_DROP_MM);
    expect(ceilingDropMm(-5)).toBe(MIN_CEILING_DROP_MM);
    expect(ceilingDropMm(Number.NaN)).toBe(MIN_CEILING_DROP_MM);
  });

  it('rechaza un descenso por encima del tope diciendo que el campo va en centímetros', () => {
    const doc = room(), id = deriveRooms(doc)[0]!.id;
    expect(() => setRoomCeiling(doc, id, { kind: 'suspended', dropMm: 1500 }))
      .toThrow(`como mucho ${MAX_CEILING_DROP_MM / 10} cm`);
  });

  it('explica con qué descenso, qué altura libre queda y cuál es el mínimo', () => {
    const doc = room(), id = deriveRooms(doc)[0]!.id;
    // 2,50 m de muro menos 60 cm de descenso: 1,90 m libres, por debajo del mínimo.
    expect(() => setRoomCeiling(doc, id, { kind: 'suspended', dropMm: MAX_CEILING_DROP_MM }))
      .toThrow(/Con 60 cm de descenso quedan 1,90 m libres; el mínimo es 2,10 m\./);
  });

  it('propaga ese mismo motivo cuando ninguna estancia admite el techo de la planta', () => {
    expect(() => setCeilingsForAllRooms(room(), { kind: 'suspended', dropMm: MAX_CEILING_DROP_MM }))
      .toThrow(/Ninguna estancia admite ese techo\. Con 60 cm de descenso quedan 1,90 m libres/);
    const applied = setCeilingsForAllRooms(room(), { kind: 'suspended', dropMm: 150 });
    expect([applied.applied, applied.skipped, applied.skippedReason]).toEqual([1, 0, null]);
  });
});
