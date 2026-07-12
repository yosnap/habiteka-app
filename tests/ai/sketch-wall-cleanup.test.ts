/**
 * Limpieza topológica de muros extraídos: colapso de caras dobles y fusión de
 * tramos colineales — los dos defectos sistemáticos vistos en bocetos reales.
 */
import { describe, expect, it } from 'vitest';
import { collapseDoubleWalls, mergeCollinear } from '@/server/ai/sketch/wall-cleanup';

describe('collapseDoubleWalls', () => {
  it('funde las dos caras de un muro grueso en su eje central', () => {
    const out = collapseDoubleWalls(
      [
        { x1: 0.1, y1: 0.5, x2: 0.9, y2: 0.5 }, // cara superior
        { x1: 0.1, y1: 0.52, x2: 0.9, y2: 0.52 }, // cara inferior (gap 0.02)
      ],
      0.045,
      12,
    );
    expect(out).toHaveLength(1);
    // Eje central entre ambas caras.
    expect(out[0]!.y1).toBeCloseTo(0.51, 5);
    expect(out[0]!.y2).toBeCloseTo(0.51, 5);
  });

  it('NO funde dos tabiques paralelos separados (distancia real)', () => {
    const out = collapseDoubleWalls(
      [
        { x1: 0.1, y1: 0.2, x2: 0.9, y2: 0.2 },
        { x1: 0.1, y1: 0.6, x2: 0.9, y2: 0.6 },
      ],
      0.045,
      12,
    );
    expect(out).toHaveLength(2);
  });

  it('NO funde segmentos paralelos cercanos sin solape de recorrido', () => {
    const out = collapseDoubleWalls(
      [
        { x1: 0.1, y1: 0.5, x2: 0.4, y2: 0.5 },
        { x1: 0.6, y1: 0.52, x2: 0.9, y2: 0.52 }, // misma línea, tramo disjunto
      ],
      0.045,
      12,
    );
    expect(out).toHaveLength(2);
  });
});

describe('mergeCollinear', () => {
  it('encadena tramos colineales que comparten extremo en un solo muro', () => {
    const out = mergeCollinear(
      [
        { x1: 0.1, y1: 0.5, x2: 0.4, y2: 0.5 },
        { x1: 0.4, y1: 0.5, x2: 0.7, y2: 0.5 },
        { x1: 0.7, y1: 0.5, x2: 0.9, y2: 0.5 },
      ],
      12,
      0.03,
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({ x1: 0.1, y1: 0.5, x2: 0.9, y2: 0.5 });
  });

  it('NO fusiona una esquina en L (perpendiculares que comparten extremo)', () => {
    const out = mergeCollinear(
      [
        { x1: 0.1, y1: 0.5, x2: 0.5, y2: 0.5 },
        { x1: 0.5, y1: 0.5, x2: 0.5, y2: 0.9 },
      ],
      12,
      0.03,
    );
    expect(out).toHaveLength(2);
  });

  it('respeta una junta en T: el travesaño no absorbe al montante', () => {
    const out = mergeCollinear(
      [
        { x1: 0.1, y1: 0.5, x2: 0.9, y2: 0.5 }, // travesaño
        { x1: 0.5, y1: 0.5, x2: 0.5, y2: 0.9 }, // montante perpendicular
      ],
      12,
      0.03,
    );
    expect(out).toHaveLength(2);
  });
});
