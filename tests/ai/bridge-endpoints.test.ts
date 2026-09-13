import { describe, expect, it } from 'vitest';
import { bridgeCollinearGaps } from '@/server/ai/sketch/wall-cleanup';

describe('puenteo conserva todo el muro, independientemente del orden', () => {
  it('une los extremos más cercanos, no el primer par dentro de la tolerancia', () => {
    const result = bridgeCollinearGaps([
      { x1: .3, y1: .455, x2: .3, y2: .52 },
      { x1: .3, y1: .268, x2: .3, y2: .421 },
    ], 12, .24, .03);
    expect(result.walls).toHaveLength(1);
    expect(Math.min(result.walls[0]!.y1,result.walls[0]!.y2)).toBeCloseTo(.268);
    expect(Math.max(result.walls[0]!.y1,result.walls[0]!.y2)).toBeCloseTo(.52);
    expect(result.gaps[0]!.width).toBeCloseTo(.034);
  });
});
