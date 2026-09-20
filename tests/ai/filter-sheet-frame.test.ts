import { describe, expect, it } from 'vitest';
import { filterSheetFrame } from '@/server/plan/filter-sheet-frame';
import type { SketchWall } from '@/server/ai/sketch/sketch-types';

const rectangle = (left: number, top: number, right: number, bottom: number): SketchWall[] => [
  {x1:left,y1:top,x2:right,y2:top}, {x1:right,y1:top,x2:right,y2:bottom},
  {x1:right,y1:bottom,x2:left,y2:bottom}, {x1:left,y1:bottom,x2:left,y2:top},
];
describe('marco de hoja no es fachada', () => {
  it('retira el marco con una vivienda separada en el interior', () => {
    const home = rectangle(.12,.27,.9,.65);
    expect(filterSheetFrame([...rectangle(.01,.01,.99,.99), ...rectangle(.02,.02,.98,.98), ...home])).toEqual(home);
  });
  it('conserva una habitación que ocupa toda la imagen', () => {
    const room = rectangle(.02,.02,.98,.98);
    expect(filterSheetFrame(room)).toEqual(room);
  });
  it('no confunde una fachada y tabiques conectados con un marco', () => {
    const home = [...rectangle(.02,.02,.98,.98), ...rectangle(.02,.2,.5,.7)];
    expect(filterSheetFrame(home)).toEqual(home);
  });
});
