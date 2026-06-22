import { describe, it, expect } from 'vitest';
import { buildRoomDoc, isValidRoom } from '@/canvas/wizard/build-room-doc';
import { docToScene } from '@/canvas/3d/doc-to-scene';

describe('build-room-doc: validación', () => {
  it('rechaza medidas no positivas o no finitas', () => {
    expect(isValidRoom({ widthM: 0, lengthM: 3, ceilingHeightM: 2.5 })).toBe(false);
    expect(isValidRoom({ widthM: 4, lengthM: -1, ceilingHeightM: 2.5 })).toBe(false);
    expect(isValidRoom({ widthM: 4, lengthM: 3, ceilingHeightM: NaN })).toBe(false);
    expect(isValidRoom({ widthM: 4, lengthM: 3, ceilingHeightM: 2.5 })).toBe(true);
  });
});

describe('build-room-doc: estructura del doc', () => {
  const doc = buildRoomDoc({ widthM: 5, lengthM: 4, ceilingHeightM: 2.7 });

  it('genera 4 muros de contorno', () => {
    expect(doc.objects).toHaveLength(4);
    expect(doc.objects.every((o) => o.kind === 'wall')).toBe(true);
  });

  it('fija escala (100 px/m) y altura de techo', () => {
    expect(doc.scale?.pxPerMeter).toBe(100);
    expect(doc.ceilingHeightM).toBeCloseTo(2.7);
  });

  it('arranca sin muebles, trazos ni imagen base', () => {
    expect(doc.products).toHaveLength(0);
    expect(doc.strokes).toHaveLength(0);
    expect(doc.baseImage).toBeNull();
  });
});

describe('build-room-doc: el INTERIOR mide lo pedido', () => {
  it('docToScene da un suelo cercano a las medidas interiores + 1 grosor de muro', () => {
    // Interior 5×4 m; el bounding box del contorno = interior + 2·(medio grosor por lado)
    // ≈ interior + grosor (0,15 m). docToScene mide el bbox del contorno.
    const scene = docToScene(buildRoomDoc({ widthM: 5, lengthM: 4, ceilingHeightM: 2.5 }));
    expect(scene.floor.size[0]).toBeGreaterThanOrEqual(5);
    expect(scene.floor.size[0]).toBeLessThanOrEqual(5 + 0.4);
    expect(scene.floor.size[1]).toBeGreaterThanOrEqual(4);
    expect(scene.floor.size[1]).toBeLessThanOrEqual(4 + 0.4);
  });

  it('los muros se extruyen a la altura de techo', () => {
    const scene = docToScene(buildRoomDoc({ widthM: 3, lengthM: 3, ceilingHeightM: 3 }));
    expect(scene.walls.every((w) => Math.abs(w.size[1] - 3) < 1e-6)).toBe(true);
  });
});
