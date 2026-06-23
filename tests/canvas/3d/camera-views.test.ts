import { describe, it, expect } from 'vitest';
import { cameraForAngle, VIEW_ANGLES } from '@/canvas/3d/camera-views';

describe('cameraForAngle', () => {
  it('la cenital mira recto hacia abajo desde arriba del centro', () => {
    const v = cameraForAngle('cenital', 6, 2.6);
    expect(v.position[1]).toBeGreaterThan(v.target[1]); // cámara por encima del objetivo
    expect(Math.abs(v.position[0])).toBeLessThan(0.01); // centrada en X
    expect(v.target).toEqual([0, 1.3, 0]); // mira al centro a media altura
  });

  it('la perspectiva está a la altura de los ojos (más baja que la isométrica)', () => {
    const persp = cameraForAngle('perspectiva', 6, 2.6);
    const iso = cameraForAngle('isometrica', 6, 2.6);
    expect(persp.position[1]).toBeLessThan(iso.position[1]);
  });

  it('respeta un span mínimo para salas pequeñas', () => {
    const small = cameraForAngle('isometrica', 1, 2.6);
    // span se acota a 4 → posición proporcional a 4, no a 1.
    expect(small.position[0]).toBeGreaterThanOrEqual(4 * 0.9);
  });

  it('expone los 3 ángulos con etiqueta', () => {
    expect(VIEW_ANGLES.map((a) => a.id)).toEqual(['perspectiva', 'isometrica', 'cenital']);
    expect(VIEW_ANGLES.every((a) => a.label.length > 0)).toBe(true);
  });
});
