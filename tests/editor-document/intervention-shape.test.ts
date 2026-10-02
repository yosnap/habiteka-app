import { describe, expect, it } from 'vitest';
import { interventionShape, moveIntervention, resizeIntervention, rotateIntervention } from '@/lib/editor-document/intervention-shape';
import { validIntervention } from '@/lib/editor-document/geographic-site';
const rectangle = [{ x: .4, y: .4 }, { x: .6, y: .4 }, { x: .6, y: .7 }, { x: .4, y: .7 }];
describe('independent intervention shape', () => {
  it('rotates to 110 degrees while preserving its centre and size', () => {
    const before = interventionShape(rectangle), rotated = rotateIntervention(rectangle, 110), after = interventionShape(rotated);
    expect(after.angle).toBeCloseTo(110);
    expect(after.center.x).toBeCloseTo(before.center.x); expect(after.center.y).toBeCloseTo(before.center.y);
    expect(after.width).toBeCloseTo(before.width); expect(after.depth).toBeCloseTo(before.depth);
    expect(validIntervention(rotated)).toBe(true);
    expect(rectangle[0]).toEqual({ x: .4, y: .4 });
  });
  it('resizes a rotated rectangle along its own axes', () => {
    const rotated = rotateIntervention(rectangle, 110), resized = resizeIntervention(rotated, 'width', .4);
    const shape = interventionShape(resized);
    expect(shape.angle).toBeCloseTo(110); expect(shape.width).toBeCloseTo(.4); expect(shape.depth).toBeCloseTo(.3);
    expect(validIntervention(resized)).toBe(true);
  });
  it('moves the whole mask without distorting it at the photograph edge', () => {
    const moved = moveIntervention(rectangle, 10, -10);
    expect(Math.max(...moved.map(p => p.x))).toBeCloseTo(1);
    expect(Math.min(...moved.map(p => p.y))).toBeCloseTo(0);
    expect(interventionShape(moved).width).toBeCloseTo(.2);
    expect(interventionShape(moved).depth).toBeCloseTo(.3);
  });
});
