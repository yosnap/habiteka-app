import { describe, expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { addLuminaire, removeLuminaire, setRoomCeiling, updateLuminaire } from '@/lib/editor-document/ceiling-commands';
import { resolvedLuminaires } from '@/lib/editor-document/ceiling-geometry';
import { addCoveStrip, removeLightStrip } from '@/lib/editor-document/light-strip-commands';
import { resolvedStrips } from '@/lib/editor-document/light-strip-geometry';
import {
  applyLightingScene,
  deactivateLightingScene,
  removeLightingScene,
  renameLightingScene,
  saveLightingScene,
  setLightingSceneLight,
  updateLightingScene,
} from '@/lib/editor-document/lighting-scene-commands';
import { activeSceneForRoom, captureScene, effectiveLuminaire, effectiveStrip } from '@/lib/editor-document/lighting-scene';
import { parseEditorDocument } from '@/lib/editor-document/validation';
import { createEditorStore } from '@/canvas/editor-v2/store';

const walls = (offset = 0) => [
  { x: offset, y: 0 }, { x: offset + 5000, y: 0 }, { x: offset + 5000, y: 5000 }, { x: offset, y: 5000 },
];
const room = () => addWallPath(emptyEditorDocument(), walls(), true);

/** Estancia con falso techo y tres luces, la tercera apagada. */
function lit() {
  let doc = room();
  const roomId = deriveRooms(doc)[0]!.id;
  doc = setRoomCeiling(doc, roomId, { kind: 'suspended', dropMm: 150 });
  const ceilingId = doc.ceilings![0]!.id;
  doc = addLuminaire(doc, ceilingId, 'flush', { x: 1500, y: 1500 });
  doc = addLuminaire(doc, ceilingId, 'flush', { x: 3500, y: 1500 });
  doc = addLuminaire(doc, ceilingId, 'flush', { x: 2500, y: 3500 });
  doc = updateLuminaire(doc, doc.luminaires![2]!.id, { enabled: false });
  return { doc, roomId, ceilingId };
}

describe('capa efectiva de las escenas de iluminación', () => {
  it('sin escena activa los valores efectivos son los nominales', () => {
    const { doc, roomId } = lit();
    expect(activeSceneForRoom(doc, roomId)).toBeNull();
    for (const resolved of resolvedLuminaires(doc)) {
      expect(resolved.effectiveTemperatureK).toBe(resolved.luminaire.temperatureK);
      expect(resolved.effectiveLumens).toBe(resolved.luminaire.lumens);
      expect(resolved.effectiveEnabled).toBe(resolved.luminaire.enabled);
    }
    const light = doc.luminaires![0]!;
    expect(effectiveLuminaire(light, null)).toEqual({ temperatureK: light.temperatureK, lumens: light.lumens, enabled: true });
  });

  it('acota el flujo efectivo al rango de validación sin escribirlo', () => {
    const scene = { id: 's', roomId: 'room:[]', name: 'X', temperatureK: 2200, intensityPct: 150, offLightIds: [], offStripIds: [], active: true };
    expect(effectiveLuminaire({ id: 'a', temperatureK: 3000, lumens: 9000, enabled: true }, scene).lumens).toBe(10_000);
    expect(effectiveLuminaire({ id: 'a', temperatureK: 3000, lumens: 60, enabled: true }, { ...scene, intensityPct: 10 }).lumens).toBe(50);
    expect(effectiveStrip({ id: 'b', temperatureK: 3000, lumensPerMeter: 1800, enabled: true }, scene).lumensPerMeter).toBe(2000);
  });
});

describe('comandos de escenas de iluminación', () => {
  it('captura el ambiente de la estancia con la luz apagada en offLightIds', () => {
    const { doc, roomId } = lit();
    const captured = captureScene(doc, roomId, '  Cena  ');
    expect(captured.name).toBe('Cena');
    expect(captured.offLightIds).toEqual([doc.luminaires![2]!.id]);
    expect(captured.intensityPct).toBe(100);
    const saved = saveLightingScene(doc, roomId, 'Cena');
    expect(saved.schemaVersion).toBe(12);
    expect(activeSceneForRoom(saved, roomId)!.name).toBe('Cena');
    expect(parseEditorDocument(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
  });

  it('activar una segunda escena desactiva la primera', () => {
    const { doc, roomId } = lit();
    let next = saveLightingScene(doc, roomId, 'Cena');
    next = saveLightingScene(next, roomId, 'Lectura');
    expect(activeSceneForRoom(next, roomId)!.name).toBe('Lectura');
    const first = next.lightingScenes!.find((scene) => scene.name === 'Cena')!;
    next = applyLightingScene(next, first.id);
    expect(next.lightingScenes!.filter((scene) => scene.active)).toHaveLength(1);
    expect(activeSceneForRoom(next, roomId)!.name).toBe('Cena');
    expect(activeSceneForRoom(deactivateLightingScene(next, roomId), roomId)).toBeNull();
  });

  it('la intensidad no toca los lúmenes del documento y sí los resueltos', () => {
    const { doc, roomId } = lit();
    const saved = saveLightingScene(doc, roomId, 'Cena');
    const dimmed = updateLightingScene(saved, saved.lightingScenes![0]!.id, { intensityPct: 50, temperatureK: 2200 });
    expect(dimmed.luminaires).toEqual(doc.luminaires);
    const resolved = resolvedLuminaires(dimmed);
    expect(resolved[0]!.luminaire.lumens).toBe(1200);
    expect(resolved[0]!.effectiveLumens).toBe(600);
    expect(resolved[0]!.effectiveTemperatureK).toBe(2200);
    expect(resolved[2]!.effectiveEnabled).toBe(false);
    // Desactivarla devuelve el ambiente nominal sin tocar las luminarias.
    expect(resolvedLuminaires(deactivateLightingScene(dimmed, roomId))[0]!.effectiveLumens).toBe(1200);
  });

  it('aplica la escena también a las tiras LED de la estancia', () => {
    const { doc, roomId, ceilingId } = lit();
    const withCove = addCoveStrip(doc, ceilingId);
    const saved = saveLightingScene(withCove, roomId, 'Cena');
    const dimmed = updateLightingScene(saved, saved.lightingScenes![0]!.id, { intensityPct: 50 });
    expect(dimmed.lightStrips![0]!.lumensPerMeter).toBe(withCove.lightStrips![0]!.lumensPerMeter);
    const resolved = resolvedStrips(dimmed)[0]!;
    expect(resolved.effectiveLumensPerMeter).toBe(Math.round(withCove.lightStrips![0]!.lumensPerMeter / 2));
    expect(resolved.effectiveLumens).toBeCloseTo(resolved.lumens / 2, 3);
  });

  it('borrar una luminaria o una tira limpia su id de las escenas', () => {
    const { doc, roomId, ceilingId } = lit();
    const withCove = addCoveStrip(doc, ceilingId);
    let next = saveLightingScene(withCove, roomId, 'Cena');
    const stripId = next.lightStrips![0]!.id;
    next = updateLightingScene(next, next.lightingScenes![0]!.id, { offStripIds: [stripId] });
    next = removeLuminaire(next, doc.luminaires![2]!.id);
    expect(next.lightingScenes![0]!.offLightIds).toEqual([]);
    next = removeLightStrip(next, stripId);
    expect(next.lightingScenes![0]!.offStripIds).toEqual([]);
    expect(parseEditorDocument(next)).toEqual(next);
  });

  it('una escena de una estancia no afecta a la otra', () => {
    let doc = addWallPath(room(), walls(9000), true);
    const rooms = deriveRooms(doc);
    expect(rooms).toHaveLength(2);
    for (const item of rooms) doc = setRoomCeiling(doc, item.id, { kind: 'suspended', dropMm: 150 });
    for (const ceiling of doc.ceilings!) doc = addLuminaire(doc, ceiling.id, 'flush');
    const saved = saveLightingScene(doc, rooms[0]!.id, 'Cena');
    const dimmed = updateLightingScene(saved, saved.lightingScenes![0]!.id, { intensityPct: 50 });
    const resolved = resolvedLuminaires(dimmed);
    const mine = resolved.find((item) => item.roomId === rooms[0]!.id)!;
    const other = resolved.find((item) => item.roomId === rooms[1]!.id)!;
    expect(mine.effectiveLumens).toBe(600);
    expect(other.effectiveLumens).toBe(other.luminaire.lumens);
  });

  it('renombra, borra y respeta el máximo por estancia; deshacer restaura el ambiente', () => {
    const { doc, roomId } = lit();
    let next = doc;
    for (const name of ['A', 'B', 'C', 'D']) next = saveLightingScene(next, roomId, name);
    expect(() => saveLightingScene(next, roomId, 'E')).toThrow('escenas');
    expect(() => renameLightingScene(next, next.lightingScenes![0]!.id, '   ')).toThrow('nombre');
    next = renameLightingScene(next, next.lightingScenes![0]!.id, 'Cena');
    expect(next.lightingScenes![0]!.name).toBe('Cena');
    const store = createEditorStore(doc);
    const applied = setLightingSceneLight(next, next.lightingScenes![3]!.id, doc.luminaires![0]!.id, false);
    store.getState().apply(applied);
    expect(resolvedLuminaires(store.getState().document)[0]!.effectiveEnabled).toBe(false);
    store.getState().undo();
    expect(store.getState().document).toEqual(doc);
    next = removeLightingScene(applied, applied.lightingScenes![0]!.id);
    expect(next.lightingScenes).toHaveLength(3);
  });
});
