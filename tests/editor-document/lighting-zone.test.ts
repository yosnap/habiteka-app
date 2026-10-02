import { describe, expect, it } from 'vitest';
import { emptyEditorDocument, type EditorDocument, type Point } from '@/lib/editor-document/schema';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { addLuminaire, setRoomCeiling } from '@/lib/editor-document/ceiling-commands';
import { addCoveStrip, addFreeStrip } from '@/lib/editor-document/light-strip-commands';
import { lightsInZone, pointInZone, stripsInZone } from '@/lib/editor-document/lighting-zone';

const rectangle = (width: number, depth: number) =>
  addWallPath(emptyEditorDocument(), [
    { x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: depth }, { x: 0, y: depth },
  ] as Point[], true);
const box = (x: number, y: number, width: number, height: number): Point[] => [
  { x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height },
];
/** Estancia de 6×5 m con falso techo y tres luminarias repartidas. */
const lit = (): EditorDocument => {
  const base = rectangle(6000, 5000);
  const covered = setRoomCeiling(base, deriveRooms(base)[0]!.id, { kind: 'suspended', dropMm: 150 });
  const id = covered.ceilings![0]!.id;
  let doc = addLuminaire(covered, id, 'pendant', { x: 1000, y: 1000 });
  doc = addLuminaire(doc, id, 'pendant', { x: 2000, y: 1000 });
  return addLuminaire(doc, id, 'pendant', { x: 5000, y: 4000 });
};

describe('selección de luces por zona', () => {
  it('cuenta el borde como dentro y deja fuera lo que no toca la zona', () => {
    const zone = box(0, 0, 2000, 2000);
    expect(pointInZone({ x: 1000, y: 1000 }, zone)).toBe(true);
    // Criterio documentado: una luz justo sobre el trazo de la zona entra.
    expect(pointInZone({ x: 2000, y: 1000 }, zone)).toBe(true);
    expect(pointInZone({ x: 2000, y: 2000 }, zone)).toBe(true);
    expect(pointInZone({ x: 2100, y: 1000 }, zone)).toBe(false);
    expect(pointInZone({ x: 1000, y: 1000 }, zone.slice(0, 2))).toBe(false);
  });

  it('selecciona las luminarias dentro de la zona y ninguna con una zona vacía de luces', () => {
    const doc = lit();
    const ids = (zone: Point[]) => lightsInZone(doc, [zone]).map((light) => ({ x: light.x, y: light.y }));
    expect(ids(box(0, 0, 2000, 2000))).toEqual([{ x: 1000, y: 1000 }, { x: 2000, y: 1000 }]);
    expect(ids(box(3000, 3000, 500, 500))).toEqual([]);
    // Una zona sobre toda la estancia coge todas sus luces.
    expect(lightsInZone(doc, [box(-500, -500, 8000, 7000)])).toHaveLength(3);
    expect(lightsInZone(rectangle(3000, 3000), [box(0, 0, 3000, 3000)])).toEqual([]);
  });

  it('coge la tira que cruza la zona aunque sea en parte y descarta la que queda fuera', () => {
    const base = lit();
    const doc = addFreeStrip(
      addCoveStrip(base, base.ceilings![0]!.id),
      [{ x: 500, y: 3000 }, { x: 3500, y: 3000 }],
    );
    const free = doc.lightStrips!.find((strip) => strip.kind === 'free')!;
    const cove = doc.lightStrips!.find((strip) => strip.kind === 'cove')!;
    // La zona muerde un trozo del tramo libre: cuenta aunque solo lo cruce en parte.
    expect(stripsInZone(doc, [box(1000, 2800, 1200, 400)]).map((strip) => strip.id)).toEqual([free.id]);
    // Zona interior que no llega a ninguna tira.
    expect(stripsInZone(doc, [box(2500, 1000, 600, 600)])).toEqual([]);
    // Zona sobre toda la estancia: entran las dos.
    expect(stripsInZone(doc, [box(-500, -500, 8000, 7000)]).map((strip) => strip.id).sort())
      .toEqual([cove.id, free.id].sort());
    expect(stripsInZone(base, [box(0, 0, 6000, 5000)])).toEqual([]);
  });
});
