import { describe, expect, it } from 'vitest';
import { FURNITURE_PHOTO_VIEW, OPENING_PHOTO_VIEW, framePhotoCamera, projectToImage, type PhotoBounds, type Vec3 }
  from '@/canvas/editor-v2/scene/catalog-photo-framing';

const corners = ({ min, max }: PhotoBounds): Vec3[] =>
  [min[0], max[0]].flatMap((x) => [min[1], max[1]].flatMap((y) => [min[2], max[2]].map((z): Vec3 => [x, y, z])));
const sofa: PhotoBounds = { min: [-1.15, 0, -.475], max: [1.15, .85, .475] };

describe('encuadre de la foto de catálogo', () => {
  it.each([
    ['sofá', sofa, FURNITURE_PHOTO_VIEW],
    ['lámpara de pie alta y estrecha', { min: [-.2, 0, -.2], max: [.2, 1.7, .2] } as PhotoBounds, FURNITURE_PHOTO_VIEW],
    ['puerta en su muro', { min: [-.9, 0, -.1], max: [.9, 2.45, .5] } as PhotoBounds, OPENING_PHOTO_VIEW],
  ])('encaja entera la caja de un %s, centrada y con su margen', (_, bounds, view) => {
    const camera = framePhotoCamera(bounds, view, 1.5);
    const points = corners(bounds).map((corner) => projectToImage(camera, corner));
    const limit = 1 - view.margin;
    for (const point of points) {
      expect(point.depth).toBeGreaterThan(camera.near);
      expect(Math.abs(point.x)).toBeLessThanOrEqual(limit + 1e-6);
      expect(Math.abs(point.y)).toBeLessThanOrEqual(limit + 1e-6);
    }
    // Ajustada: al menos un lado toca el margen, sin dejar la pieza pequeña en medio de la imagen.
    expect(Math.max(...points.flatMap((point) => [Math.abs(point.x), Math.abs(point.y)]))).toBeCloseTo(limit, 3);
    const xs = points.map((point) => point.x), ys = points.map((point) => point.y);
    expect((Math.max(...xs) + Math.min(...xs)) / 2).toBeCloseTo(0, 2);
    expect((Math.max(...ys) + Math.min(...ys)) / 2).toBeCloseTo(0, 2);
  });

  it('mira la cara de delante (+Z) en 3/4: desde la derecha y algo desde arriba', () => {
    const camera = framePhotoCamera(sofa, FURNITURE_PHOTO_VIEW, 1.5);
    expect(camera.position[2]).toBeGreaterThan(camera.target[2]);
    expect(camera.position[0]).toBeGreaterThan(camera.target[0]);
    expect(camera.position[1]).toBeGreaterThan(camera.target[1]);
    // La puerta se ve casi de frente: el giro es menor que el de un mueble.
    const door = framePhotoCamera(sofa, OPENING_PHOTO_VIEW, 1.5);
    const turn = (c: typeof camera) => Math.atan2(c.position[0] - c.target[0], c.position[2] - c.target[2]);
    expect(turn(door)).toBeLessThan(turn(camera));
  });

  it('una pieza el doble de grande se fotografía desde el doble de distancia', () => {
    const scaled: PhotoBounds = { min: sofa.min.map((v) => v * 2) as Vec3, max: sofa.max.map((v) => v * 2) as Vec3 };
    const distance = (c: ReturnType<typeof framePhotoCamera>) => Math.hypot(...c.position.map((v, i) => v - c.target[i]!));
    expect(distance(framePhotoCamera(scaled, FURNITURE_PHOTO_VIEW, 1.5)))
      .toBeCloseTo(2 * distance(framePhotoCamera(sofa, FURNITURE_PHOTO_VIEW, 1.5)), 6);
  });

  it('rechaza medidas o encuadres no válidos', () => {
    expect(() => framePhotoCamera({ min: [0, 0, 0], max: [Number.NaN, 1, 1] }, FURNITURE_PHOTO_VIEW, 1.5)).toThrow();
    expect(() => framePhotoCamera(sofa, FURNITURE_PHOTO_VIEW, 0)).toThrow();
    expect(() => framePhotoCamera(sofa, { ...FURNITURE_PHOTO_VIEW, margin: 1 }, 1.5)).toThrow();
  });
});
