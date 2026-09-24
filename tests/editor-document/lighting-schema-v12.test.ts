import { describe, expect, it } from 'vitest';
import { emptyEditorDocument, type EditorDocument, type LightStrip } from '@/lib/editor-document/schema';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { addLuminaire, setRoomCeiling } from '@/lib/editor-document/ceiling-commands';
import { upgradeLightingDocument } from '@/lib/editor-document/lighting-migration';
import { parseEditorDocument } from '@/lib/editor-document/validation';
import { addBuildingLevel } from '@/lib/editor-document/building-levels';

const room = () =>
  addWallPath(
    emptyEditorDocument(),
    [
      { x: 0, y: 0 },
      { x: 5000, y: 0 },
      { x: 5000, y: 5000 },
      { x: 0, y: 5000 },
    ],
    true,
  );
/** Plano con techo y una luminaria: el documento queda en v12 al editar iluminación. */
const lit = () => {
  const base = room();
  const covered = setRoomCeiling(base, deriveRooms(base)[0]!.id);
  return addLuminaire(covered, covered.ceilings![0]!.id, 'flush', { x: 2000, y: 2000 });
};
const strip = (patch: Partial<LightStrip> = {}): LightStrip => ({
  id: 'strip-1',
  kind: 'free',
  pathMm: [
    { x: 500, y: 500 },
    { x: 3500, y: 500 },
  ],
  derived: false,
  elevationMm: 2400,
  color: '#ffe6bf',
  temperatureK: 3000,
  lumensPerMeter: 600,
  enabled: true,
  ...patch,
});
const withStrips = (doc: EditorDocument, ...strips: LightStrip[]) => ({ ...doc, lightStrips: strips });

describe('esquema v12 de iluminación', () => {
  it('mantiene los documentos v11 intactos y les prohíbe los campos nuevos', () => {
    const doc = lit();
    const legacy = { ...structuredClone(doc), schemaVersion: 11 as const };
    delete (legacy as Record<string, unknown>).lightStrips;
    delete (legacy as Record<string, unknown>).lightingScenes;
    delete (legacy as Record<string, unknown>).lightZones;
    expect(parseEditorDocument(legacy)).toEqual(legacy);
    expect(parseEditorDocument(legacy).schemaVersion).toBe(11);
    expect(() => parseEditorDocument({ ...legacy, lightStrips: [] })).toThrow('Campo desconocido');
    const tilted = structuredClone(legacy);
    tilted.luminaires![0]!.tiltDeg = 20;
    expect(() => parseEditorDocument(tilted)).toThrow('Campo de techo o luminaria desconocido');
  });

  it('admite el foco orientable solo con montaje, inclinación y giro válidos', () => {
    const doc = lit();
    expect(doc.schemaVersion).toBe(12);
    const spot = { ...doc.luminaires![0]!, kind: 'spot' as const, mount: 'surface' as const, tiltDeg: 35, azimuthDeg: 210, dropMm: 120 };
    const valid = { ...doc, luminaires: [spot] };
    expect(parseEditorDocument(valid)).toEqual(valid);
    expect(() => parseEditorDocument({ ...doc, luminaires: [{ ...spot, mount: undefined }] })).toThrow('montaje');
    expect(() => parseEditorDocument({ ...doc, luminaires: [{ ...spot, tiltDeg: 61 }] })).toThrow('Inclinación');
    expect(() => parseEditorDocument({ ...doc, luminaires: [{ ...spot, azimuthDeg: -1 }] })).toThrow('Giro');
    expect(() => parseEditorDocument({ ...doc, luminaires: [{ ...spot, mount: 'recessed' }] })).toThrow('caída');
    expect(() => parseEditorDocument({ ...doc, luminaires: [{ ...doc.luminaires![0]!, tiltDeg: 10 }] })).toThrow('foco orientable');
  });

  it('valida el recorrido, el anclaje y el rango de las tiras LED', () => {
    const doc = lit(), ceilingId = doc.ceilings![0]!.id;
    const free = withStrips(doc, strip());
    expect(parseEditorDocument(free)).toEqual(free);
    expect(() => parseEditorDocument(withStrips(doc, strip({ kind: 'cove' })))).toThrow('Foseado sin techo');
    expect(() =>
      parseEditorDocument(
        withStrips(doc, strip({ id: 'a', kind: 'cove', ceilingId, derived: true }), strip({ id: 'b', kind: 'cove', ceilingId, derived: true })),
      ),
    ).toThrow('un foseado por techo');
    expect(() => parseEditorDocument(withStrips(doc, strip({ pathMm: [{ x: 0, y: 0 }] })))).toThrow('Recorrido');
    expect(() => parseEditorDocument(withStrips(doc, strip({ pathMm: [{ x: 0, y: 0 }, { x: 70_000, y: 0 }] })))).toThrow('60 m');
    expect(() => parseEditorDocument(withStrips(doc, strip({ derived: true })))).toThrow('tramo libre');
    const noPath = strip();
    delete (noPath as Partial<LightStrip>).pathMm;
    expect(() => parseEditorDocument(withStrips(doc, noPath))).toThrow('Recorrido');
    expect(() => parseEditorDocument(withStrips(doc, strip({ lumensPerMeter: 0 })))).toThrow('Flujo por metro');
    expect(() => parseEditorDocument(withStrips(doc, strip({ ceilingId })))).toThrow('Solo el foseado');
  });

  it('valida nombre, contorno y tope de las zonas de luces', () => {
    const doc = lit();
    const square = [
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
      { x: 1000, y: 1000 },
      { x: 0, y: 1000 },
    ];
    const zones = (...items: unknown[]) => ({ ...doc, lightZones: items });
    const valid = zones({ id: 'z1', name: 'Salón', polygonsMm: [square] });
    expect(parseEditorDocument(valid)).toEqual(valid);
    expect(() => parseEditorDocument(zones({ id: 'z1', name: '  ', polygonsMm: [square] }))).toThrow('Nombre');
    expect(() => parseEditorDocument(zones({ id: 'z1', name: 'A', polygonsMm: [square.slice(0, 2)] }))).toThrow('Contorno');
    expect(() =>
      parseEditorDocument(
        zones({ id: 'z1', name: 'A', polygonsMm: [Array.from({ length: 21 }, (_, i) => ({ x: i * 100, y: i % 2 ? 0 : 100 }))] }),
      ),
    ).toThrow('Contorno');
    const bowtie = [
      { x: 0, y: 0 },
      { x: 1000, y: 1000 },
      { x: 1000, y: 0 },
      { x: 0, y: 1000 },
    ];
    expect(() => parseEditorDocument(zones({ id: 'z1', name: 'A', polygonsMm: [bowtie] }))).toThrow('se cruza');
    expect(() =>
      parseEditorDocument(zones({ id: 'z1', name: 'Salón', polygonsMm: [square] }, { id: 'z2', name: 'Salón', polygonsMm: [square] })),
    ).toThrow('ese nombre');
    expect(() =>
      parseEditorDocument({
        ...doc,
        lightZones: Array.from({ length: 13 }, (_, i) => ({ id: `z${i}`, name: `Zona ${i}`, polygonsMm: [square] })),
      }),
    ).toThrow('máximo 12');
  });

  it('solo admite una escena activa por estancia y la intensidad dentro de rango', () => {
    const doc = lit(), roomId = doc.ceilings![0]!.roomId;
    const scene = (patch: Record<string, unknown>) => ({
      id: 's1', roomId, name: 'Cena', temperatureK: 2700, intensityPct: 80, offLightIds: [], offStripIds: [], active: false, ...patch,
    });
    const valid = { ...doc, lightingScenes: [scene({ active: true, offLightIds: [doc.luminaires![0]!.id] })] };
    expect(parseEditorDocument(valid)).toEqual(valid);
    expect(() =>
      parseEditorDocument({ ...doc, lightingScenes: [scene({ active: true }), scene({ id: 's2', active: true })] }),
    ).toThrow('una escena activa por estancia');
    expect(() => parseEditorDocument({ ...doc, lightingScenes: [scene({ intensityPct: 200 })] })).toThrow('Intensidad');
    expect(() => parseEditorDocument({ ...doc, lightingScenes: [scene({ offLightIds: ['fantasma'] })] })).toThrow('ya no existen');
  });

  it('migra a 12 una sola vez, con colecciones vacías y recorriendo las plantas', () => {
    const base = room();
    const covered = setRoomCeiling(base, deriveRooms(base)[0]!.id);
    expect(covered.schemaVersion).toBe(12);
    const legacy = { ...structuredClone(covered), schemaVersion: 8 as const, lightStrips: undefined, lightingScenes: undefined, lightZones: undefined, kitchenRuns: undefined, boundaries: undefined, walkthroughs: undefined };
    for (const key of ['lightStrips', 'lightingScenes', 'lightZones', 'kitchenRuns', 'boundaries', 'walkthroughs'])
      delete (legacy as Record<string, unknown>)[key];
    const migrated = upgradeLightingDocument(legacy as EditorDocument);
    expect(migrated.schemaVersion).toBe(12);
    expect(migrated.lightStrips).toEqual([]);
    expect(migrated.lightingScenes).toEqual([]);
    expect(migrated.lightZones).toEqual([]);
    expect(upgradeLightingDocument(migrated)).toEqual(migrated);
    const stacked = addBuildingLevel(migrated);
    const levelled = upgradeLightingDocument(stacked);
    for (const level of levelled.levels!)
      if (level.document) expect(level.document.schemaVersion).toBe(12);
  });
});
