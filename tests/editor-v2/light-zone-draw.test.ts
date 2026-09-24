import { describe, expect, it } from 'vitest';
import type { Point } from '@/lib/editor-document/schema';
import { MAX_ZONE_PARTS } from '@/lib/editor-document/light-zone-validation';
import {
  addZoneRectangle,
  addZoneVertex,
  closeZonePart,
  draftBlocker,
  draftPolygons,
  emptyLightZoneDraft,
  toggleRoomPart,
  undoZoneVertex,
  ZONE_CLOSE_RADIUS_MM,
} from '@/canvas/editor-v2/light-zone-draw';

const box = (x: number, y: number, side: number): Point[] => [
  { x, y }, { x: x + side, y }, { x: x + side, y: y + side }, { x, y: y + side },
];
const room = (id: string, x: number) => ({ roomId: id, polygon: box(x, 0, 3000) });

describe('trazo de zonas de luces sobre el plano', () => {
  it('suma y quita estancias en el modo estancia sin cerrar el trazo', () => {
    const empty = emptyLightZoneDraft('room');
    expect(draftBlocker(empty)).toMatch('al menos una parte');
    const one = toggleRoomPart(empty, room('a', 0));
    expect([one.done, one.error]).toEqual([false, null]);
    const two = toggleRoomPart(one.draft, room('b', 5000));
    expect(two.draft.parts.map((part) => part.roomId)).toEqual(['a', 'b']);
    expect(draftBlocker(two.draft)).toBeNull();
    // El segundo clic sobre la misma estancia la quita de la zona.
    const back = toggleRoomPart(two.draft, room('a', 0));
    expect(back.draft.parts.map((part) => part.roomId)).toEqual(['b']);
    expect(draftPolygons(back.draft)).toEqual([box(5000, 0, 3000)]);
  });

  it('avisa al pasar del tope de partes en vez de perder el trazo', () => {
    let draft = emptyLightZoneDraft('room');
    for (let index = 0; index < MAX_ZONE_PARTS; index++)
      draft = toggleRoomPart(draft, room(`r${index}`, index * 4000)).draft;
    const extra = toggleRoomPart(draft, room('extra', 99000));
    expect(extra.error).toMatch(`${MAX_ZONE_PARTS} partes`);
    expect(extra.draft.parts).toHaveLength(MAX_ZONE_PARTS);
  });

  it('cierra el contorno punto a punto sobre el primer vértice y termina el trazo', () => {
    let draft = emptyLightZoneDraft('polygon');
    for (const point of [{ x: 0, y: 0 }, { x: 2000, y: 0 }, { x: 2000, y: 2000 }])
      draft = addZoneVertex(draft, point).draft;
    expect(undoZoneVertex(draft).vertices).toHaveLength(2);
    const closed = addZoneVertex(draft, { x: ZONE_CLOSE_RADIUS_MM / 2, y: 0 });
    expect([closed.done, closed.error]).toEqual([true, null]);
    expect(closed.draft.vertices).toEqual([]);
    expect(closed.draft.parts).toHaveLength(1);
  });

  it('rechaza contornos cortos o con lazos con el motivo concreto', () => {
    const short = closeZonePart(addZoneVertex(emptyLightZoneDraft('polygon'), { x: 0, y: 0 }).draft);
    expect(short.error).toMatch('tres vértices');
    let bowtie = emptyLightZoneDraft('polygon');
    for (const point of [{ x: 0, y: 0 }, { x: 2000, y: 2000 }, { x: 2000, y: 0 }, { x: 0, y: 2000 }])
      bowtie = addZoneVertex(bowtie, point).draft;
    expect(closeZonePart(bowtie).error).toMatch('se cruza');
  });

  it('cierra con un rectángulo bastante grande y descarta el clic suelto', () => {
    const draft = emptyLightZoneDraft('rectangle');
    const tiny = addZoneRectangle(draft, { x: 0, y: 0 }, { x: 10, y: 10 });
    expect([tiny.done, tiny.draft.parts.length]).toEqual([false, 0]);
    expect(tiny.error).toMatch('30 cm');
    const drawn = addZoneRectangle(draft, { x: 1000, y: 1000 }, { x: 3000, y: 2000 });
    expect(drawn.done).toBe(true);
    expect(draftPolygons(drawn.draft)).toEqual([[
      { x: 1000, y: 1000 }, { x: 3000, y: 1000 }, { x: 3000, y: 2000 }, { x: 1000, y: 2000 },
    ]]);
  });
});
