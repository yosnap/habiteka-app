import { describe, expect, it } from 'vitest';
import { aliasRoomIds, hoistSharedDefaults } from '@/server/agent/editor-v2/interior-prompt-scope';

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
});
