import { describe, expect, it } from 'vitest';
import { emptyEditorDocument, type EditorDocument, type Point } from '@/lib/editor-document/schema';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { addLuminaire, setRoomCeiling } from '@/lib/editor-document/ceiling-commands';
import {
  addLightZone,
  removeLightZone,
  renameLightZone,
  setLightZonePolygons,
} from '@/lib/editor-document/light-zone-commands';
import { MAX_LIGHT_ZONES } from '@/lib/editor-document/light-zone-validation';
import { parseEditorDocument } from '@/lib/editor-document/validation';

const rectangle = (width: number, depth: number) =>
  addWallPath(emptyEditorDocument(), [
    { x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: depth }, { x: 0, y: depth },
  ] as Point[], true);
const square = (x: number, y: number, side: number): Point[] => [
  { x, y }, { x: x + side, y }, { x: x + side, y: y + side }, { x, y: y + side },
];
const lit = (): EditorDocument => {
  const base = rectangle(6000, 5000);
  const covered = setRoomCeiling(base, deriveRooms(base)[0]!.id);
  return addLuminaire(covered, covered.ceilings![0]!.id, 'pendant', { x: 1500, y: 1500 });
};

describe('comandos de zonas de luces', () => {
  it('guarda la zona, sube a v12 sin mutar el original y sobrevive a guardar y volver a parsear', () => {
    const doc = rectangle(6000, 5000), original = structuredClone(doc);
    const saved = addLightZone(doc, 'Salón', [square(0, 0, 3000)]);
    expect(doc).toEqual(original);
    expect(saved.schemaVersion).toBe(12);
    expect(saved.lightZones).toHaveLength(1);
    expect(saved.lightZones![0]!.name).toBe('Salón');
    expect(parseEditorDocument(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
  });

  it('rechaza el nombre repetido y admite renombrar a uno libre', () => {
    const doc = addLightZone(rectangle(6000, 5000), 'Salón', [square(0, 0, 3000)]);
    expect(() => addLightZone(doc, ' Salón ', [square(3200, 0, 1000)])).toThrow('Ya hay otra zona');
    const two = addLightZone(doc, 'Cocina', [square(3200, 0, 1000)]);
    expect(() => renameLightZone(two, two.lightZones![1]!.id, 'Salón')).toThrow('Ya hay otra zona');
    const renamed = renameLightZone(two, two.lightZones![1]!.id, 'Office');
    expect(renamed.lightZones!.map((zone) => zone.name)).toEqual(['Salón', 'Office']);
    // Renombrar una zona a su propio nombre no choca consigo misma.
    expect(renameLightZone(renamed, renamed.lightZones![0]!.id, 'Salón').lightZones![0]!.name).toBe('Salón');
    expect(() => renameLightZone(renamed, renamed.lightZones![0]!.id, '  ')).toThrow('Pon un nombre');
  });

  it('redibuja conservando el nombre y no admite una zona número 13', () => {
    let doc = rectangle(20000, 20000);
    for (let index = 0; index < MAX_LIGHT_ZONES; index++)
      doc = addLightZone(doc, `Zona ${index + 1}`, [square(index * 1000, 0, 800)]);
    expect(doc.lightZones).toHaveLength(MAX_LIGHT_ZONES);
    expect(() => addLightZone(doc, 'Una más', [square(0, 5000, 800)])).toThrow(`${MAX_LIGHT_ZONES} zonas`);
    const id = doc.lightZones![0]!.id;
    const redrawn = setLightZonePolygons(doc, id, [square(0, 9000, 2500)]);
    expect(redrawn.lightZones![0]!.name).toBe('Zona 1');
    expect(redrawn.lightZones![0]!.polygonsMm[0]![0]).toEqual({ x: 0, y: 9000 });
    expect(() => setLightZonePolygons(doc, 'inexistente', [square(0, 0, 900)])).toThrow('inexistente');
  });

  it('rechaza contornos imposibles y borra la zona sin tocar luces ni tiras', () => {
    const doc = addLightZone(lit(), 'Salón', [square(0, 0, 3000)]);
    expect(() => addLightZone(doc, 'Aguja', [[{ x: 0, y: 0 }, { x: 1000, y: 0 }] as Point[]])).toThrow('Contorno');
    expect(() => setLightZonePolygons(doc, doc.lightZones![0]!.id, [[
      { x: 0, y: 0 }, { x: 2000, y: 2000 }, { x: 2000, y: 0 }, { x: 0, y: 2000 },
    ]])).toThrow('cruza');
    const cleared = removeLightZone(doc, doc.lightZones![0]!.id);
    expect(cleared.lightZones).toEqual([]);
    expect(cleared.luminaires).toEqual(doc.luminaires);
  });
});
