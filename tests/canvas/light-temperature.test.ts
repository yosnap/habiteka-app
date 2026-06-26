import { describe, it, expect } from 'vitest';
import { kelvinToRGB, lightColor } from '@/canvas/light';

describe('kelvinToRGB (temperatura de color)', () => {
  it('2700K es cálida (R > B)', () => {
    const { r, b } = kelvinToRGB(2700);
    expect(r).toBeGreaterThan(b);
    expect(r).toBe(255);
  });

  it('6500K es fría (B >= R)', () => {
    const { r, b } = kelvinToRGB(6500);
    expect(b).toBeGreaterThanOrEqual(r - 10);
  });

  it('5500K es neutra (R ≈ B)', () => {
    const { r, b } = kelvinToRGB(5500);
    expect(Math.abs(r - b)).toBeLessThan(40);
  });

  it('clamp: 500K → 1000K (mínimo)', () => {
    const c = kelvinToRGB(500);
    expect(c.r).toBe(255);
  });
});

describe('lightColor (color efectivo)', () => {
  it('sin temperature → usa color hex', () => {
    expect(lightColor({ color: '#ff0000', intensidad: 50 })).toBe('#ff0000');
  });

  it('con temperature → usa kelvinToRGB', () => {
    const c = lightColor({ color: '#ff0000', intensidad: 50, temperature: 2700 });
    expect(c).toMatch(/^#[0-9a-f]{6}$/i);
    expect(c).not.toBe('#ff0000');
  });

  it('on === false → null (apagada)', () => {
    expect(lightColor({ color: '#ff0000', intensidad: 50, on: false })).toBeNull();
  });

  it('on ausente → encendida', () => {
    expect(lightColor({ color: '#ff0000', intensidad: 50 })).toBe('#ff0000');
  });
});
