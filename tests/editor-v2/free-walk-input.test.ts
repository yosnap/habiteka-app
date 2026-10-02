import { describe, expect, it } from 'vitest';
import { thirdPersonCameraOffset, walkDelta, walkInputDelta, walkOpenFocus, walkPitch, walkTurn } from '@/components/editor-v2/scene/free-walk-input';
import { FreeWalkController } from '@/components/editor-v2/scene/free-walk-controller';

describe('controles de la visita libre', () => {
  it('mueve a la derecha de la cámara con D o el control táctil, también tras girar', () => {
    expect(walkDelta(0, 0, 1, 100)).toEqual({ x: -100, y: 0 });
    expect(walkDelta(0, 0, -1, 100)).toEqual({ x: 100, y: 0 });
    const turned = walkDelta(Math.PI / 2, 0, 1, 100);
    expect(turned.x).toBeCloseTo(0);
    expect(turned.y).toBeCloseTo(100);
    expect(walkDelta(0, 1, 0, 100)).toEqual({ x: 0, y: 100 });
  });

  it('↑ y ↓ caminan hacia delante y atrás según la mirada; ← y → giran sin desplazar', () => {
    const noTouch = { forward: 0, strafe: 0 };
    expect(walkInputDelta(0, new Set(['ArrowUp']), noTouch, 100)).toEqual({ x: 0, y: 100 });
    expect(walkInputDelta(0, new Set(['ArrowDown']), noTouch, 100).x).toBeCloseTo(0);
    expect(walkInputDelta(0, new Set(['ArrowDown']), noTouch, 100).y).toBe(-100);
    expect(walkInputDelta(0, new Set(['ArrowLeft']), noTouch, 100)).toEqual({ x: 0, y: 0 });
    expect(walkInputDelta(0, new Set(['ArrowRight']), noTouch, 100)).toEqual({ x: 0, y: 0 });
    expect(walkInputDelta(Math.PI / 2, new Set(['ArrowUp']), noTouch, 100).x).toBeCloseTo(100);
    expect(walkTurn(0, new Set(['ArrowLeft']), 0, .5)).toBeGreaterThan(0);
    expect(walkTurn(0, new Set(['ArrowRight']), 0, .5)).toBeLessThan(0);
    expect(walkTurn(0, new Set(), -1, .5)).toBeGreaterThan(0);
    expect(walkInputDelta(0, new Set(['KeyD']), noTouch, 100)).toEqual({ x: -100, y: 0 });
  });

  it('mira arriba con R o ratón hacia arriba, abajo con F y limita el ángulo', () => {
    expect(walkPitch(0, 0, 1, .5)).toBeGreaterThan(0);
    expect(walkPitch(0, 0, -1, .5)).toBeLessThan(0);
    expect(walkPitch(0, -100, 0, 0)).toBeGreaterThan(0);
    expect(walkPitch(1.3, -1000, 1, 1)).toBe(1.35);
    expect(walkPitch(-1.3, 1000, -1, 1)).toBe(-1.35);
  });

  it('busca un lateral libre si no cabe la cámara detrás del avatar', () => {
    expect(thirdPersonCameraOffset(() => true, { x: 0, y: 0 }, 0).y).toBe(-1800);
    const offset = thirdPersonCameraOffset((point) => point.y >= -700, { x: 0, y: 0 }, 0);
    expect(Math.hypot(offset.x, offset.y)).toBeGreaterThan(600);
    expect(thirdPersonCameraOffset(() => false, { x: 0, y: 0 }, 0).y).toBe(-200);
  });

  it('orienta el inicio hacia espacio transitable sin ruta', () => {
    const focus = walkOpenFocus({ x: 0, y: 0 }, (_from, to) => to.x <= 0 && to.x > -2200 && Math.abs(to.y) < 600);
    expect(focus.x).toBeLessThan(-1500);
    expect(Math.abs(focus.y)).toBeLessThan(600);
  });

  it('conserva un rastro acotado y lo reinicia al cambiar de planta o salir', () => {
    const controller = new FreeWalkController();
    for (let x = 0; x <= 6000; x += 120) controller.setPose({ x, y: 0, yaw: 0, levelId: 'ground' });
    expect(controller.getTrail()).toHaveLength(40);
    expect(controller.getTrail().at(-1)?.x).toBe(6000);
    controller.setPose({ x: 100, y: 100, yaw: 0, levelId: 'upper' });
    expect(controller.getTrail()).toHaveLength(1);
    controller.setPose(null);
    expect(controller.getTrail()).toHaveLength(0);
  });
});
