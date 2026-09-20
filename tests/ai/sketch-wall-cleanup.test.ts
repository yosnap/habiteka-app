/**
 * Limpieza topológica de muros extraídos: colapso de caras dobles y fusión de
 * tramos colineales — los dos defectos sistemáticos vistos en bocetos reales.
 */
import { describe, expect, it } from 'vitest';
import {
  collapseDoubleWalls,
  dropIsolatedShortWalls,
  dropSmallComponents,
  mergeCollinear,
  snapEndpointsToWalls,
} from '@/server/ai/sketch/wall-cleanup';

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

  it('un tramo con desfase lateral leve se fusiona sin dejar el muro torcido tras re-alinear', () => {
    // Dos verticales casi colineales con 0.005 de desfase en x que comparten
    // extremo: la fusión produce un segmento inclinado; el pipeline completo
    // (normalize) lo re-endereza — aquí solo se comprueba que fusiona.
    const out = mergeCollinear(
      [
        { x1: 0.5, y1: 0.1, x2: 0.5, y2: 0.5 },
        { x1: 0.505, y1: 0.5, x2: 0.505, y2: 0.9 },
      ],
      12,
      0.03,
    );
    expect(out).toHaveLength(1);
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

describe('snapEndpointsToWalls', () => {
  it('cierra una junta en T: el montante se extiende hasta tocar el travesaño', () => {
    const out = snapEndpointsToWalls(
      [
        { x1: 0.1, y1: 0.2, x2: 0.9, y2: 0.2 }, // travesaño horizontal
        { x1: 0.5, y1: 0.23, x2: 0.5, y2: 0.9 }, // montante que se queda a 0.03
      ],
      0.045,
    );
    expect(out[1]!.y1).toBeCloseTo(0.2, 9);
    expect(out[1]!.x1).toBeCloseTo(0.5, 9);
  });

  it('NO desplaza lateralmente un muro hacia un paralelo cercano', () => {
    const walls = [
      { x1: 0.1, y1: 0.5, x2: 0.9, y2: 0.5 },
      { x1: 0.1, y1: 0.53, x2: 0.9, y2: 0.53 }, // paralelo a 0.03: no debe pegarse
    ];
    const out = snapEndpointsToWalls(walls, 0.045);
    expect(out[1]!.y1).toBeCloseTo(0.53, 9);
    expect(out[1]!.y2).toBeCloseTo(0.53, 9);
  });

  it('no toca extremos que ya coinciden con otro muro', () => {
    const walls = [
      { x1: 0.1, y1: 0.2, x2: 0.9, y2: 0.2 },
      { x1: 0.5, y1: 0.2, x2: 0.5, y2: 0.9 }, // ya toca exactamente
    ];
    expect(snapEndpointsToWalls(walls, 0.045)).toEqual(walls);
  });
});

describe('mergeCollinear con puenteo de vanos', () => {
  it('puentea un hueco de puerta entre tramos colineales (joinTol grande)', () => {
    const out = mergeCollinear(
      [
        { x1: 0.1, y1: 0.5, x2: 0.4, y2: 0.5 },
        { x1: 0.52, y1: 0.5, x2: 0.9, y2: 0.5 }, // hueco de 0.12 (vano)
      ],
      12,
      0.16,
      0.03,
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({ x1: 0.1, y1: 0.5, x2: 0.9, y2: 0.5 });
  });

  it('NO puentea dos muros paralelos distintos aunque sus extremos queden cerca', () => {
    const out = mergeCollinear(
      [
        { x1: 0.1, y1: 0.5, x2: 0.4, y2: 0.5 },
        { x1: 0.45, y1: 0.6, x2: 0.9, y2: 0.6 }, // desvío lateral 0.1 > tope 0.03
      ],
      12,
      0.16,
      0.03,
    );
    expect(out).toHaveLength(2);
  });
});

describe('dropSmallComponents', () => {
  it('elimina el grupito de trazos de un icono (fregadero en L) y conserva la red de muros', () => {
    const out = dropSmallComponents(
      [
        // Red de muros: perímetro parcial conectado (longitud total grande).
        { x1: 0.1, y1: 0.1, x2: 0.9, y2: 0.1 },
        { x1: 0.9, y1: 0.1, x2: 0.9, y2: 0.9 },
        // Icono de fregadero: dos trazos en L que SE TOCAN entre sí pero no
        // conectan con la red — el filtro de aislados individuales no los caza.
        { x1: 0.6, y1: 0.6, x2: 0.68, y2: 0.6 },
        { x1: 0.68, y1: 0.6, x2: 0.68, y2: 0.66 },
      ],
      0.25,
      0.03,
    );
    expect(out).toHaveLength(2);
    expect(out.every((w) => w.y1 <= 0.1 || w.x1 >= 0.9)).toBe(true);
  });

  it('conserva un tabique corto conectado a la red', () => {
    const out = dropSmallComponents(
      [
        { x1: 0.1, y1: 0.1, x2: 0.9, y2: 0.1 },
        { x1: 0.5, y1: 0.1, x2: 0.5, y2: 0.2 }, // corto pero toca el muro largo
      ],
      0.25,
      0.03,
    );
    expect(out).toHaveLength(2);
  });
});

describe('dropIsolatedShortWalls', () => {
  it('descarta el fragmento corto que flota sin tocar nada y conserva el conectado', () => {
    const out = dropIsolatedShortWalls(
      [
        { x1: 0.1, y1: 0.1, x2: 0.9, y2: 0.1 }, // muro largo
        { x1: 0.4, y1: 0.5, x2: 0.48, y2: 0.5 }, // corto y AISLADO → fuera
        { x1: 0.2, y1: 0.1, x2: 0.2, y2: 0.18 }, // corto pero toca el muro largo → se queda
      ],
      0.14,
      0.03,
    );
    expect(out).toHaveLength(2);
    expect(out.some((w) => w.y1 === 0.5)).toBe(false);
  });
});
