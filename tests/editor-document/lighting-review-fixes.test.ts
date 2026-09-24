import { describe, expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addWallPath, deleteEntities } from '@/canvas/editor-v2/editing-operations';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { addLuminaire, setRoomCeiling } from '@/lib/editor-document/ceiling-commands';
import { saveLightingScene, setLightingSceneLight } from '@/lib/editor-document/lighting-scene-commands';
import { levelLightBudgets, MAX_LUMINAIRE_LIGHTS } from '../../src/components/editor-v2/scene/ceiling-scene-utils';

describe('arreglos de la revisión de iluminación', () => {
  it('borrar con Supr una luz que una escena apaga poda la escena en vez de fallar', () => {
    let doc = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 5000 }, { x: 0, y: 5000 }], true);
    const roomId = deriveRooms(doc)[0]!.id;
    doc = setRoomCeiling(doc, roomId, {});
    doc = addLuminaire(doc, doc.ceilings![0]!.id, 'flush', { x: 2500, y: 2500 });
    const lightId = doc.luminaires![0]!.id;
    doc = saveLightingScene(doc, roomId, 'Cena');
    doc = setLightingSceneLight(doc, doc.lightingScenes![0]!.id, lightId, false);
    expect(doc.lightingScenes![0]!.offLightIds).toEqual([lightId]);
    const after = deleteEntities(doc, [lightId]);
    expect(after.luminaires).toEqual([]);
    expect(after.lightingScenes![0]!.offLightIds).toEqual([]);
  });

  it('el reparto por plantas cuenta también las tiras y nunca pasa del máximo', () => {
    const lights = (n: number) => Array.from({ length: n }, (_, i) => ({ luminaire: { id: `l${i}`, enabled: true } }));
    const strips = (n: number) => Array.from({ length: n }, (_, i) => ({ strip: { id: `s${i}`, enabled: true }, lumens: 500 }));
    // Planta activa: 6 luces + 4 tiras = 10; a la segunda le quedan 2, y a la tercera 0.
    const budgets = levelLightBudgets([
      { luminaires: lights(6), strips: strips(4) },
      { luminaires: lights(5), strips: strips(3) },
      { luminaires: lights(3), strips: [] },
    ]);
    expect(budgets).toEqual([MAX_LUMINAIRE_LIGHTS, 2, 0]);
  });
});

describe('alta de luces en un techo que ya tiene luces', () => {
  it('sin punto elegido busca un hueco libre en vez de chocar con la luz del centro', () => {
    let doc = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 5000 }, { x: 0, y: 5000 }], true);
    doc = setRoomCeiling(doc, deriveRooms(doc)[0]!.id, {});
    const ceilingId = doc.ceilings![0]!.id;
    // Tres altas seguidas sin punto: antes la segunda fallaba por superponerse en el centro.
    doc = addLuminaire(doc, ceilingId, 'flush');
    doc = addLuminaire(doc, ceilingId, 'flush');
    doc = addLuminaire(doc, ceilingId, 'spot');
    const [a, b, c] = doc.luminaires!;
    expect(new Set([a, b, c].map((light) => `${light!.x},${light!.y}`)).size).toBe(3);
  });
});
