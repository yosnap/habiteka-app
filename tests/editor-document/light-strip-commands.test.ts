import { describe, expect, it } from 'vitest';
import { emptyEditorDocument, type EditorDocument, type Point } from '@/lib/editor-document/schema';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { removeCeiling, setRoomCeiling } from '@/lib/editor-document/ceiling-commands';
import { ceilingWarnings } from '@/lib/editor-document/ceiling-geometry';
import {
  addCoveStrip,
  addFreeStrip,
  refitLightStrip,
  removeLightStrip,
  setLightStripPath,
  updateLightStrip,
  updateLightStrips,
} from '@/lib/editor-document/light-strip-commands';
import { COVE_INSET_MM, resolvedStrips } from '@/lib/editor-document/light-strip-geometry';
import { stripLengthMm } from '@/lib/editor-document/light-strip-types';

const rectangle = (width: number, depth: number) =>
  addWallPath(emptyEditorDocument(), [
    { x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: depth }, { x: 0, y: depth },
  ] as Point[], true);
const ceilinged = (width = 5000, depth = 4000, kind: 'plain' | 'suspended' = 'suspended', dropMm = 150) => {
  const base = rectangle(width, depth);
  return setRoomCeiling(base, deriveRooms(base)[0]!.id, { kind, dropMm });
};
const ceilingId = (doc: EditorDocument) => doc.ceilings![0]!.id;
const onlyStrip = (doc: EditorDocument) => doc.lightStrips![0]!;
/** Estancia con falso techo y su foseado ya creado. */
const coved = () => { const doc = ceilinged(); return addCoveStrip(doc, ceilingId(doc)); };

describe('alta del foseado', () => {
  it('crea una tira derivada con el perímetro retranqueado y sube el documento a v12', () => {
    const doc = ceilinged();
    const boundary = deriveRooms(doc)[0]!.boundary;
    const perimeter = stripLengthMm([...boundary, boundary[0]!]);
    const next = addCoveStrip(doc, ceilingId(doc));
    expect(next.schemaVersion).toBe(12);
    expect(onlyStrip(next).derived).toBe(true);
    expect(stripLengthMm(onlyStrip(next).pathMm)).toBeCloseTo(perimeter - 8 * COVE_INSET_MM, 6);
  });

  it('rechaza el foseado sobre un techo plano', () => {
    const doc = ceilinged(5000, 4000, 'plain', 0);
    expect(() => addCoveStrip(doc, ceilingId(doc))).toThrow(/falso techo/);
  });

  it('rechaza un segundo foseado en el mismo techo', () => {
    const doc = coved();
    expect(() => addCoveStrip(doc, ceilingId(doc))).toThrow(/ya tiene foseado/);
  });

  it('rechaza el foseado de una estancia demasiado estrecha', () => {
    const base = rectangle(6000, 240);
    const doc = setRoomCeiling(base, deriveRooms(base)[0]!.id, { kind: 'suspended', dropMm: 150 });
    expect(() => addCoveStrip(doc, ceilingId(doc))).toThrow(/demasiado estrecha/);
  });
});

describe('tramo libre', () => {
  it('nace desligado de toda geometría', () => {
    const doc = addFreeStrip(ceilinged(), [{ x: 500, y: 200 }, { x: 3500, y: 200 }]);
    expect(onlyStrip(doc).kind).toBe('free');
    expect(onlyStrip(doc).derived).toBe(false);
    expect(doc.schemaVersion).toBe(12);
  });

  it('rechaza un recorrido fuera de toda estancia', () => {
    expect(() => addFreeStrip(ceilinged(), [{ x: 20000, y: 0 }, { x: 23000, y: 0 }]))
      .toThrow(/dentro de una estancia/);
  });

  it('rechaza una cota que no cabe bajo el techo', () => {
    expect(() => addFreeStrip(ceilinged(), [{ x: 500, y: 200 }, { x: 3500, y: 200 }], { elevationMm: 2600 }))
      .toThrow(/Baja la cota/);
  });

  it('no admite reajuste: no sigue a ningún muro', () => {
    const doc = addFreeStrip(ceilinged(), [{ x: 500, y: 200 }, { x: 3500, y: 200 }]);
    expect(() => refitLightStrip(doc, onlyStrip(doc).id)).toThrow(/tramo libre/);
  });
});

describe('derivado y ajuste a mano', () => {
  it('retocar el recorrido desliga la tira y conserva los puntos dados', () => {
    const path = [{ x: 1000, y: 1000 }, { x: 3000, y: 1000 }, { x: 3000, y: 2500 }];
    const base = coved();
    const doc = setLightStripPath(base, onlyStrip(base).id, path);
    expect(onlyStrip(doc).derived).toBe(false);
    expect(onlyStrip(doc).pathMm).toEqual(path);
    expect(resolvedStrips(doc)[0]!.pathMm).toEqual(path);
  });

  it('reajustar devuelve el recorrido derivado', () => {
    const base = coved();
    const derivedPath = onlyStrip(base).pathMm;
    const edited = setLightStripPath(base, onlyStrip(base).id, [{ x: 1000, y: 1000 }, { x: 3000, y: 1000 }]);
    const refitted = refitLightStrip(edited, onlyStrip(edited).id);
    expect(onlyStrip(refitted).derived).toBe(true);
    expect(onlyStrip(refitted).pathMm).toEqual(derivedPath);
  });

  it('editar campos refresca la instantánea de la tira derivada', () => {
    const doc = coved();
    // El muro se mueve: la instantánea guardada se queda corta hasta la siguiente edición.
    const stale = { ...doc, lightStrips: [{ ...onlyStrip(doc), pathMm: [{ x: 500, y: 500 }, { x: 1500, y: 500 }] }] };
    const next = updateLightStrip(stale, onlyStrip(doc).id, { lumensPerMeter: 900 });
    expect(onlyStrip(next).pathMm).toEqual(onlyStrip(doc).pathMm);
    expect(onlyStrip(next).lumensPerMeter).toBe(900);
  });

  it('la edición en bloque es todo o nada', () => {
    const doc = addFreeStrip(coved(), [{ x: 500, y: 200 }, { x: 3500, y: 200 }]);
    const ids = doc.lightStrips!.map((strip) => strip.id);
    expect(updateLightStrips(doc, ids, { enabled: false }).lightStrips!.every((strip) => !strip.enabled)).toBe(true);
    expect(() => updateLightStrips(doc, ids, { elevationMm: 3900 })).toThrow(/No se aplicó a ninguna/);
  });
});

describe('ciclo de vida', () => {
  it('borrar el techo borra su foseado', () => {
    const doc = coved();
    expect(removeCeiling(doc, ceilingId(doc)).lightStrips).toEqual([]);
  });

  it('eliminar una tira la quita del documento', () => {
    const doc = coved();
    expect(removeLightStrip(doc, onlyStrip(doc).id).lightStrips).toEqual([]);
  });

  it('las incidencias de tira salen por los avisos del techo', () => {
    const doc = addFreeStrip(ceilinged(), [{ x: 500, y: 200 }, { x: 3500, y: 200 }]);
    const broken = { ...doc, lightStrips: [{ ...onlyStrip(doc), elevationMm: 2600 }] };
    expect(ceilingWarnings(broken).some((warning) => /Tira LED 1/.test(warning))).toBe(true);
  });
});
