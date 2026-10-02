import { describe, expect, it } from 'vitest';
import { aliasRoomIds, dropEmptyLists, hoistSharedDefaults, indexWallVertices, roundSpotAngles, shareRoomBoundaries } from '@/server/agent/editor-v2/interior-prompt-scope';
import type { ScopePayload } from '@/server/agent/editor-v2/interior-prompt-scope';

const long = 'room:["w1","w2","w3","w4"]';

describe('recortes sin pérdida del prompt compacto', () => {
  it('sustituye los ids largos de estancia por r0, r1… en todas sus referencias', () => {
    const out = aliasRoomIds({ levels: [{
      rooms: [{ id: long, areaM2: 10 }], floors: [{ roomId: long }], ceilings: [{ id: 'c', roomId: long }], luminaires: [{ id: 'l', roomId: long }],
    }] });
    expect(out.levels[0]).toMatchObject({ rooms: [{ id: 'r0' }], floors: [{ roomId: 'r0' }], ceilings: [{ roomId: 'r0' }], luminaires: [{ roomId: 'r0' }] });
  });
  it('escribe una vez los valores comunes y conserva los que difieren', () => {
    const wall = (id: string, thicknessM: number) => ({ id, thicknessM, heightM: 2.7, baseElevationM: 0, pathM: [] });
    const out = hoistSharedDefaults({ levels: [{ walls: [wall('a', 0.08), wall('b', 0.08), wall('c', 0.2)] }] });
    const level = out.levels[0] as Record<string, unknown>;
    expect(level.wallDefaults).toEqual({ thicknessM: 0.08, heightM: 2.7, baseElevationM: 0 });
    expect(level.walls).toEqual([{ id: 'a', pathM: [] }, { id: 'b', pathM: [] }, wall('c', 0.2)]);
  });
  it('no toca listas con un solo elemento', () => {
    const input = { levels: [{ walls: [{ id: 'a', thicknessM: 0.1, heightM: 2.7, baseElevationM: 0 }] }] };
    expect(hoistSharedDefaults(input)).toEqual(input);
  });
  it('escribe cada vértice una vez y los muros rectos por índice; los curvos quedan igual', () => {
    const curve = [{ x: 0, y: 0 }, { x: 1, y: 0.5 }, { x: 2, y: 0 }];
    const out = indexWallVertices({ levels: [{ walls: [
      { id: 'a', pathM: [{ x: 0, y: 0 }, { x: 4, y: 0 }] },
      { id: 'b', pathM: [{ x: 4, y: 0 }, { x: 4, y: 3 }] },
      { id: 'c', pathM: curve },
    ] }] });
    expect(out.levels[0]).toEqual({ verticesM: [[0, 0], [4, 0], [4, 3]], walls: [
      { id: 'a', pathM: [0, 1] }, { id: 'b', pathM: [1, 2] }, { id: 'c', pathM: curve },
    ] });
  });

  it('conserva null como estancia desconocida de una tira suelta', () => {
    const out = aliasRoomIds({ levels: [{ rooms: [{ id: long }], lightStrips: [{ id: 's', roomId: null }, { id: 't', roomId: long }] }] });
    expect(out.levels[0]!.lightStrips).toEqual([{ id: 's', roomId: null }, { id: 't', roomId: 'r0' }]);
  });

  it('escribe el contorno de cada estancia una vez y no el de su techo', () => {
    const boundaryM = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }];
    const out = shareRoomBoundaries({ levels: [{
      rooms: [{ id: 'a', boundaryM }, { id: 'b', boundaryM: [] }],
      ceilings: [{ id: 'c1', roomId: 'a', boundaryM }, { id: 'c2', roomId: 'b', boundaryM }],
    }] });
    expect(out.levels[0]!.ceilings).toEqual([{ id: 'c1', roomId: 'a' }, { id: 'c2', roomId: 'b', boundaryM }]);
  });

  it('quita las listas vacías de una planta y respeta las que tienen contenido', () => {
    const out = dropEmptyLists({ levels: [{ id: 'g', walls: [{ id: 'w' }], columns: [], lightingScenes: [] }] });
    expect(out.levels[0]).toEqual({ id: 'g', walls: [{ id: 'w' }] });
  });

  it('redondea la orientación del foco a grado entero y no toca el resto de luces', () => {
    const payload = { levels: [{ luminaires: [
      { id: 'a', kind: 'spot', tiltDeg: 30.44, azimuthDeg: 90.6 },
      { id: 'b', kind: 'flush', lumens: 1200.5 },
    ] }] } as unknown as ScopePayload;
    expect(roundSpotAngles(payload).levels[0]!.luminaires).toEqual([
      { id: 'a', kind: 'spot', tiltDeg: 30, azimuthDeg: 91 },
      { id: 'b', kind: 'flush', lumens: 1200.5 },
    ]);
  });
});
