import { describe, expect, it } from 'vitest';
import { MAX_TOUR_SHOTS, assessTourHomogeneity, orderTourImages, pickTourImages, tourDurationMs, tourFrameAt, TOUR_FADE_MS, TOUR_SHOT_MS, WHOLE_PROPERTY, type TourImage } from '@/lib/editor-document/image-tour';

const image = (id: string, ambient: string, view: string, extra: Partial<TourImage> = {}): TourImage =>
  ({ id, ambient, view, lighting: 'daylight', freedom: 'strict', revision: 137, createdAt: '2026-09-30T02:00:00Z', url: `https://x/${id}.png`, ...extra });

describe('montaje con las imágenes generadas', () => {
  it('no mezcla muebles originales y rediseñados en la misma presentación', () => {
    const result = assessTourHomogeneity([image('a', 'Salón', 'custom'),
      image('b', 'Salón', 'custom', { redesignInterior: true })], new Set([137]));
    expect(result.ok).toBe(false);
    expect(result.issues).toMatchObject([{ code: 'redesign', imageIds: ['b'] }]);
  });
  it('Jev distingue imágenes con fijos conservados de imágenes con rediseño', () => {
    const result = assessTourHomogeneity([image('a', 'Cocina', 'top'),
      image('b', 'Salón', 'custom', { redesignFixed: true })], new Set([137]));
    expect(result.ok).toBe(false);
    expect(result.issues).toMatchObject([{ code: 'redesign', imageIds: ['b'] }]);
  });
  it('no rellena la selección aprobada con zonas de revisiones antiguas', () => {
    const result = pickTourImages([image('old', 'Patio', 'top', { revision: 100 }),
      image('new', 'Cocina', 'top', { revision: 143 })], ['Patio'], 2, MAX_TOUR_SHOTS, new Set([143]));
    expect(result.shots.map((shot) => shot.id)).toEqual(['new']);
    expect(result.missing).toEqual(['Patio']);
  });
  it('conserva dormitorios distintos aunque tengan el mismo nombre y ángulo', () => {
    expect(pickTourImages([image('uno', 'Dormitorio', 'custom', { ambientId: 'room:1' }),
      image('dos', 'Dormitorio', 'custom', { ambientId: 'room:2' })]).shots).toHaveLength(2);
  });
  it('una estancia compartida cubre sus zonas y mantiene el aviso de un ámbito sin imágenes', () => {
    const result = pickTourImages([image('interior', 'Salón-cocina', 'custom', { coveredAmbients: ['Salón', 'Cocina'] })], ['Salón', 'Cocina', 'Patio']);
    expect(result.missing).toEqual(['Patio']);
    expect(result.shots).toHaveLength(1);
  });
  it('no declara cobertura de tomas que quedan fuera del límite de selección', () => {
    expect(pickTourImages([image('a', 'A', 'top'), image('b', 'B', 'top')], ['A', 'B'], 2, 1).missing).toEqual(['B']);
  });
  it('abre con el inmueble completo y sigue por ámbitos, con una imagen por ámbito y vista', () => {
    const { shots } = pickTourImages([
      image('cocina-iso', 'Cocina', 'isometric'), image('salon-top', 'Salón', 'top'),
      image('todo-front', WHOLE_PROPERTY, 'front'), image('todo-drone', WHOLE_PROPERTY, 'drone'),
    ]);
    expect(shots.map((s) => s.id)).toEqual(['todo-drone', 'todo-front', 'cocina-iso', 'salon-top']);
  });

  it('entre duplicados elige la de día, la más fiel y la más reciente', () => {
    const { shots } = pickTourImages([
      image('noche', 'Cocina', 'top', { lighting: 'evening' }),
      image('libre', 'Cocina', 'top', { freedom: 'free' }),
      image('vieja', 'Cocina', 'top', { revision: 120 }),
      image('buena', 'Cocina', 'top'),
    ]);
    expect(shots.map((s) => s.id)).toEqual(['buena']);
  });

  it('limita las vistas por ámbito y el total, y avisa de los ámbitos sin imagen', () => {
    const many = ['Cocina', 'Salón', 'Patio'].flatMap((name) => ['top', 'isometric', 'left', 'right'].map((view) => image(`${name}-${view}`, name, view)));
    const { shots, missing } = pickTourImages(many, ['Cocina', 'Baño'], 2);
    expect(shots).toHaveLength(6);
    expect(missing).toEqual(['Baño']);
    const lots = Array.from({ length: 40 }, (_, i) => image(`a${i}`, `Ámbito ${i}`, 'top'));
    expect(pickTourImages(lots).shots).toHaveLength(MAX_TOUR_SHOTS);
  });

  it('ordenar respeta las imágenes elegidas a mano, incluso dos de la misma vista', () => {
    const ordered = orderTourImages([image('c2', 'Cocina', 'top'), image('c1', 'Cocina', 'top', { revision: 100 }), image('d', WHOLE_PROPERTY, 'drone'), image('a', 'Baño', 'top')]);
    expect(ordered.map((s) => s.id)).toEqual(['d', 'a', 'c2', 'c1']);
  });

  it('la duración descuenta los fundidos entre imágenes', () => {
    expect(tourDurationMs(0)).toBe(0);
    expect(tourDurationMs(1)).toBe(TOUR_SHOT_MS);
    expect(tourDurationMs(3)).toBe(3 * TOUR_SHOT_MS - 2 * TOUR_FADE_MS);
  });

  it('cada instante da el mismo fotograma y el fundido deja la imagen anterior debajo', () => {
    const step = TOUR_SHOT_MS - TOUR_FADE_MS;
    expect(tourFrameAt(3, 0)).toEqual(tourFrameAt(3, 0));
    expect(tourFrameAt(3, 100)).toMatchObject({ index: 0, previous: null, alpha: 1 });
    const fading = tourFrameAt(3, step + TOUR_FADE_MS / 2);
    expect(fading.index).toBe(1);
    expect(fading.previous).toBe(0);
    expect(fading.alpha).toBeCloseTo(.5, 5);
    expect(fading.layers.map((layer) => layer.index)).toEqual([0, 1]);
    expect(tourFrameAt(3, step + TOUR_FADE_MS + 10)).toMatchObject({ index: 1, previous: null, alpha: 1 });
    const last = tourFrameAt(3, tourDurationMs(3));
    expect(last).toMatchObject({ index: 2, previous: null, alpha: 1 });
  });

  it('el zoom crece a lo largo de la toma sin salirse del rango', () => {
    const start = tourFrameAt(2, 0).layers[0]!, later = tourFrameAt(2, 2000).layers[0]!;
    expect(start.zoom).toBeCloseTo(1, 5);
    expect(later.zoom).toBeGreaterThan(start.zoom);
    expect(later.zoom).toBeLessThanOrEqual(1.09);
  });

  describe('homogeneidad del conjunto', () => {
    const valid = new Set([143, 141]);
    it('acepta un conjunto del diseño aprobado con la misma luz y fidelidad', () => {
      const shots = [image('a', 'Cocina', 'top', { revision: 143 }), image('b', 'Salón', 'top', { revision: 141 })];
      expect(assessTourHomogeneity(shots, valid)).toEqual({ ok: true, issues: [] });
    });

    it('detecta imágenes de otra revisión, luces mezcladas, fidelidad distinta y ámbitos sin imagen', () => {
      const shots = [image('a', 'Cocina', 'top', { revision: 143 }), image('b', 'Salón', 'top', { revision: 120, lighting: 'evening', freedom: 'free' })];
      const result = assessTourHomogeneity(shots, valid, ['Entrada']);
      expect(result.ok).toBe(false);
      expect(result.issues.map((issue) => issue.code)).toEqual(['revision', 'lighting', 'freedom', 'missing']);
      expect(result.issues[3]!.message).toContain('Entrada');
      expect(result.issues[0]!.imageIds).toEqual(['b']);
      expect(result.issues[0]!.message).toContain('120');
    });

    it('señala como discordantes las imágenes minoritarias, no las mayoritarias', () => {
      const shots = [image('n1', 'Cocina', 'top', { lighting: 'evening', revision: 143 }), image('n2', 'Salón', 'top', { lighting: 'evening', revision: 143 }),
        image('d1', 'Patio', 'top', { lighting: 'daylight', revision: 143 })];
      const lighting = assessTourHomogeneity(shots, new Set([143])).issues.find((issue) => issue.code === 'lighting')!;
      expect(lighting.imageIds).toEqual(['d1']);
    });

    it('sin diseño aprobado no reprocha la revisión de las imágenes', () => {
      const shots = [image('a', 'Cocina', 'top', { revision: 5 }), image('b', 'Salón', 'top', { revision: 9 })];
      expect(assessTourHomogeneity(shots, null)).toEqual({ ok: true, issues: [] });
    });

    it('al elegir prefiere las imágenes del diseño aprobado aunque sean más antiguas en luz o fidelidad', () => {
      const { shots } = pickTourImages([image('vieja', 'Cocina', 'top', { revision: 100 }), image('valida', 'Cocina', 'top', { revision: 143, freedom: 'controlled' })], [], 2, MAX_TOUR_SHOTS, valid);
      expect(shots.map((s) => s.id)).toEqual(['valida']);
    });
  });
});
