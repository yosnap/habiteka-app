import { describe, expect, it } from 'vitest';
import { containedImageRect, boxBetween, nudgeImageRegion } from '@/lib/image-region-selection';

describe('selección sobre la imagen visible', () => {
  it('excluye bandas superiores y laterales para no desplazar la máscara', () => {
    expect(containedImageRect({ width: 1200, height: 900 }, { width: 1200, height: 600 }))
      .toEqual({ x: 0, y: 150, width: 1200, height: 600 });
    expect(containedImageRect({ width: 1200, height: 600 }, { width: 600, height: 600 }))
      .toEqual({ x: 300, y: 0, width: 600, height: 600 });
    expect(containedImageRect({ width: 1200, height: 600 }, { width: 0, height: 0 })).toBeNull();
  });
  it('permite dibujar en ambas direcciones y alcanzar el borde sin excederlo', () => {
    expect(boxBetween({ x: 1, y: 1 }, { x: .25, y: .5 })).toEqual({ x: .25, y: .5, width: .75, height: .5 });
  });
  it('las flechas mueven o redimensionan sin recortar fuera de la imagen', () => {
    const box = { x: .5, y: .5, width: .5, height: .5 };
    expect(nudgeImageRegion(box, 'ArrowRight', false)).toEqual(box);
    expect(nudgeImageRegion(box, 'ArrowRight', true)).toEqual(box);
    expect(nudgeImageRegion(box, 'ArrowLeft', true)).toEqual({ ...box, width: .49 });
  });
});
