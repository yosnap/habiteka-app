import { describe, expect, it } from 'vitest';
import { walkDelta, walkInputDelta, walkPitch } from '@/components/editor-v2/scene/free-walk-input';
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

  it('hace coincidir las flechas con el mini plano fijo, independientemente de la mirada', () => {
    const noTouch = { forward: 0, strafe: 0 };
    for (const yaw of [0, Math.PI / 2, Math.PI]) {
      expect(walkInputDelta(yaw, new Set(['ArrowLeft']), noTouch, 100)).toEqual({ x: -100, y: 0 });
      expect(walkInputDelta(yaw, new Set(['ArrowRight']), noTouch, 100)).toEqual({ x: 100, y: 0 });
      expect(walkInputDelta(yaw, new Set(['ArrowUp']), noTouch, 100)).toEqual({ x: 0, y: -100 });
      expect(walkInputDelta(yaw, new Set(['ArrowDown']), noTouch, 100)).toEqual({ x: 0, y: 100 });
    }
    expect(walkInputDelta(0, new Set(['KeyD']), noTouch, 100)).toEqual({ x: -100, y: 0 });
  });

  it('mira arriba con R o ratón hacia arriba, abajo con F y limita el ángulo', () => {
    expect(walkPitch(0, 0, 1, .5)).toBeGreaterThan(0);
    expect(walkPitch(0, 0, -1, .5)).toBeLessThan(0);
    expect(walkPitch(0, -100, 0, 0)).toBeGreaterThan(0);
    expect(walkPitch(1.3, -1000, 1, 1)).toBe(1.35);
    expect(walkPitch(-1.3, 1000, -1, 1)).toBe(-1.35);
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
