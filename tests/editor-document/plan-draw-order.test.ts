/** En la vista cenital una alfombra tapaba el sofá y una silla la mesa: se pintaban por orden de creación. */
import { expect, it } from 'vitest';
import { planDrawOrder } from '@/lib/editor-document/plan-draw-order';

it('pinta primero la alfombra, después las sillas, el resto y al final lo que va encima', () => {
  const items = [
    { id: 'lampara', catalogId: 'habiteka:furniture:lampara-mesa', elevationMm: 550 },
    { id: 'mesa', catalogId: 'habiteka:furniture:mesa-comedor', elevationMm: 0 },
    { id: 'silla', catalogId: 'habiteka:furniture:silla-comedor', elevationMm: 0 },
    { id: 'alfombra', catalogId: 'habiteka:furniture:alfombra', elevationMm: 0 },
    { id: 'sofa', catalogId: 'habiteka:furniture:sofa-3', elevationMm: 0 },
  ];
  expect(planDrawOrder(items).map(({ id }) => id)).toEqual(['alfombra', 'silla', 'mesa', 'sofa', 'lampara']);
});
