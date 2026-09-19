import { expect, it } from 'vitest';
import type { Polygon } from 'polygon-clipping';
import { robustDifference } from '@/canvas/editor-v2/scene/floor-meshes';

const square: Polygon = [[[0, 0], [4, 0], [4, 3], [0, 3], [0, 0]]];
const cut: Polygon = [[[1, 1], [2, 1], [2, 2], [1, 2], [1, 1]]];

it('recorta con la librería cuando funciona', () => {
  const result = robustDifference(square, [cut]);
  expect(result).toHaveLength(1);
  expect(result[0]).toHaveLength(2); // contorno + hueco
});

it('si la librería falla, reintenta con malla gruesa, luego recorte a recorte, y nunca deja la estancia sin suelo', () => {
  let calls = 0;
  const flaky = (subject: Polygon, ...clips: Polygon[]) => { calls++; if (calls <= 2) throw new Error('Unable to complete output ring'); return [subject, ...clips.map(() => subject)].slice(0, 1); };
  expect(robustDifference(square, [cut, cut], flaky)).toHaveLength(1);
  const broken = () => { throw new Error('Unable to complete output ring'); };
  const fallback = robustDifference(square, [cut], broken);
  expect(fallback).toHaveLength(1);
  expect(fallback[0]![0]).toHaveLength(5);
});
