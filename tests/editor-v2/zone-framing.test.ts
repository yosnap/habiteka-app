import { describe, expect, it } from 'vitest';
import { zoneFraming, ZONE_FRAME_MARGIN_M } from '../../src/components/editor-v2/scene/zone-framing';

const ZONE = [[{ x: 2000, y: 1000 }, { x: 6000, y: 1000 }, { x: 6000, y: 4000 }, { x: 2000, y: 4000 }]];
const keeps = (planes: ReturnType<typeof zoneFraming> extends infer F ? F extends { planes: infer P } ? P : never : never, p: [number, number, number]) =>
  planes.every((plane) => plane.normal[0] * p[0] + plane.normal[1] * p[1] + plane.normal[2] * p[2] + plane.constant >= 0);

describe('encuadre de la zona permitida', () => {
  it('encuadra solo la zona con la altura de la planta', () => {
    const framing = zoneFraming(ZONE, 'isometric', 2.7)!;
    expect(framing.focus.center).toEqual([4, 1.35, 2.5]);
    expect(framing.focus.size[0]).toBeCloseTo(4 + 2 * ZONE_FRAME_MARGIN_M);
  });
  it('en isométrica conserva los muros que cierran la zona y corta el resto', () => {
    const { planes } = zoneFraming(ZONE, 'isometric', 2.7)!;
    expect(keeps(planes, [6.1, 1, 2])).toBe(true);
    expect(keeps(planes, [7, 1, 2])).toBe(false);
    expect(keeps(planes, [1, 1, 2])).toBe(false);
  });
  it('en el alzado derecho corta por el borde de la zona del lado de la cámara', () => {
    const { planes } = zoneFraming(ZONE, 'right', 2.7)!;
    expect(keeps(planes, [5.9, 1, 2])).toBe(true);
    expect(keeps(planes, [6.05, 1, 2])).toBe(false);
    // El lado opuesto conserva su muro como fondo.
    expect(keeps(planes, [1.9, 1, 2])).toBe(true);
  });
  it('sin zonas no hay encuadre', () => expect(zoneFraming([], 'front', 2.7)).toBeNull());
});
