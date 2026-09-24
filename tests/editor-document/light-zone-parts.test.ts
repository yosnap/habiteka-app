import { describe, expect, it } from 'vitest';
import { emptyEditorDocument, type EditorDocument, type Point } from '@/lib/editor-document/schema';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { addLuminaire, setRoomCeiling } from '@/lib/editor-document/ceiling-commands';
import { addFreeStrip } from '@/lib/editor-document/light-strip-commands';
import { addLightZone, setLightZonePolygons } from '@/lib/editor-document/light-zone-commands';
import { MAX_ZONE_PARTS } from '@/lib/editor-document/light-zone-validation';
import { lightsInZone, pointInZoneParts, stripsInZone } from '@/lib/editor-document/lighting-zone';
import { parseEditorDocument } from '@/lib/editor-document/validation';

const box = (x: number, y: number, width: number, height: number): Point[] => [
  { x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height },
];

/** Dos estancias separadas por un tabique, ambas con techo y una luz cada una. */
function twoLitRooms(): EditorDocument {
  let doc = addWallPath(emptyEditorDocument(), box(0, 0, 8000, 5000), true);
  doc = addWallPath(doc, [{ x: 4000, y: 0 }, { x: 4000, y: 5000 }], false);
  for (const room of deriveRooms(doc)) doc = setRoomCeiling(doc, room.id);
  doc = addLuminaire(doc, doc.ceilings![0]!.id, 'flush');
  return addLuminaire(doc, doc.ceilings![1]!.id, 'flush');
}

describe('zonas de luces de varias partes', () => {
  it('guarda varias estancias sueltas en la misma zona y sobrevive a guardar y volver a parsear', () => {
    const doc = twoLitRooms();
    const parts = deriveRooms(doc).map((room) => room.boundary.map((point) => ({ ...point })));
    expect(parts).toHaveLength(2);
    const saved = addLightZone(doc, 'Día', parts);
    expect(saved.lightZones![0]!.polygonsMm).toHaveLength(2);
    expect(parseEditorDocument(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
  });

  it('selecciona las luces de cualquiera de sus partes, aunque no sean contiguas', () => {
    const doc = twoLitRooms();
    const left = box(500, 500, 3000, 4000), right = box(4500, 500, 3000, 4000);
    const west = doc.luminaires!.find((light) => light.x < 4000)!;
    const east = doc.luminaires!.find((light) => light.x > 4000)!;
    expect(lightsInZone(doc, [left]).map((light) => light.id)).toEqual([west.id]);
    expect(lightsInZone(doc, [right]).map((light) => light.id)).toEqual([east.id]);
    // Las dos partes juntas cogen las dos luces sin tocarse entre ellas.
    expect(lightsInZone(doc, [left, right]).map((light) => light.id).sort()).toEqual([west.id, east.id].sort());
    expect(pointInZoneParts(east, [left, right])).toBe(true);
    expect(pointInZoneParts({ x: 4200, y: 2500 }, [left, right])).toBe(false);
  });

  it('coge la tira que toca solo la segunda parte de la zona', () => {
    const base = twoLitRooms();
    const doc = addFreeStrip(base, [{ x: 4600, y: 1000 }, { x: 7000, y: 1000 }]);
    const strip = doc.lightStrips!.at(-1)!;
    expect(stripsInZone(doc, [box(500, 500, 3000, 4000)])).toEqual([]);
    expect(stripsInZone(doc, [box(500, 500, 3000, 4000), box(4500, 500, 3000, 4000)])
      .map((item) => item.id)).toEqual([strip.id]);
  });

  it('exige al menos una parte y no admite más del tope, ni en el alta ni al redibujar', () => {
    const doc = twoLitRooms();
    expect(() => addLightZone(doc, 'Vacía', [])).toThrow('entre 1 y');
    const many = Array.from({ length: MAX_ZONE_PARTS + 1 }, (_, index) => box(index * 200, 0, 150, 150));
    expect(() => addLightZone(doc, 'Demasiadas', many)).toThrow('entre 1 y');
    const saved = addLightZone(doc, 'Día', [box(0, 0, 3000, 3000)]);
    const id = saved.lightZones![0]!.id;
    expect(() => setLightZonePolygons(saved, id, [])).toThrow('entre 1 y');
    // Redibujar conserva el nombre y cambia todas sus partes de golpe.
    const redrawn = setLightZonePolygons(saved, id, [box(0, 0, 1000, 1000), box(5000, 0, 1000, 1000)]);
    expect(redrawn.lightZones![0]!.name).toBe('Día');
    expect(redrawn.lightZones![0]!.polygonsMm).toHaveLength(2);
    // Una parte inválida invalida la zona entera: no se guarda a medias.
    expect(() => setLightZonePolygons(saved, id, [box(0, 0, 1000, 1000), [{ x: 0, y: 0 }, { x: 10, y: 0 }]]))
      .toThrow('Contorno');
  });
});
