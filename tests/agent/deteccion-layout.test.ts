import { describe, it, expect } from 'vitest';
import { parseDetected, detectedToObjects } from '@/server/agent/phases/deteccion-layout';

describe('parseDetected — validador de la detección (frontera de confianza)', () => {
  it('acepta elementos con kind del catálogo y bbox dentro de [0,1]', () => {
    const out = parseDetected({
      elementos: [
        { kind: 'sofa', x: 0.1, y: 0.2, w: 0.3, h: 0.2, confianza: 0.9 },
        { kind: 'window', x: 0, y: 0, w: 0.5, h: 0.05 },
      ],
    });
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ kind: 'sofa', bbox: { x: 0.1, y: 0.2, w: 0.3, h: 0.2 }, confianza: 0.9 });
    expect(out[1]?.confianza).toBeUndefined();
  });

  it('descarta kinds desconocidos', () => {
    const out = parseDetected({ elementos: [{ kind: 'ovni', x: 0, y: 0, w: 0.2, h: 0.2 }] });
    expect(out).toHaveLength(0);
  });

  it('descarta bbox fuera de [0,1], con tamaño no positivo o que se sale de la imagen', () => {
    const out = parseDetected({
      elementos: [
        { kind: 'sofa', x: -0.1, y: 0, w: 0.2, h: 0.2 }, // x negativa
        { kind: 'sofa', x: 0, y: 0, w: 0, h: 0.2 }, // w cero
        { kind: 'sofa', x: 0.9, y: 0, w: 0.3, h: 0.2 }, // x+w > 1 (se sale)
        { kind: 'sofa', x: 0, y: 0, w: 1.5, h: 0.2 }, // w > 1
      ],
    });
    expect(out).toHaveLength(0);
  });

  it('entrada malformada devuelve lista vacía', () => {
    expect(parseDetected(null)).toEqual([]);
    expect(parseDetected({ elementos: 'no-array' })).toEqual([]);
    expect(parseDetected({})).toEqual([]);
  });
});

describe('detectedToObjects — mapeo bbox normalizada → píxeles de stage', () => {
  it('escala la bbox al tamaño del stage', () => {
    const objs = detectedToObjects(
      [{ kind: 'sofa', bbox: { x: 0.1, y: 0.2, w: 0.5, h: 0.25 } }],
      1000,
      800,
    );
    expect(objs[0]).toMatchObject({ kind: 'sofa', x: 100, y: 160, width: 500, height: 200 });
    expect(objs[0]?.rotation).toBe(0);
  });

  it('garantiza un tamaño mínimo de 8 px aunque la bbox sea diminuta', () => {
    const objs = detectedToObjects([{ kind: 'planta', bbox: { x: 0, y: 0, w: 0.001, h: 0.001 } }], 100, 100);
    expect(objs[0]?.width).toBeGreaterThanOrEqual(8);
    expect(objs[0]?.height).toBeGreaterThanOrEqual(8);
  });

  it('los ids son únicos incluso entre invocaciones distintas (sin colisión)', () => {
    const input = [
      { kind: 'sofa' as const, bbox: { x: 0, y: 0, w: 0.2, h: 0.2 } },
      { kind: 'mesa' as const, bbox: { x: 0.3, y: 0.3, w: 0.2, h: 0.2 } },
    ];
    // Dos llamadas (p. ej. el usuario detecta dos fotos): los ids del 2º lote NO
    // deben repetir los del 1º, o el store confundiría objetos al añadirlos juntos.
    const ids = [
      ...detectedToObjects(input, 500, 500),
      ...detectedToObjects(input, 500, 500),
    ].map((o) => o.id);
    expect(new Set(ids).size).toBe(4);
  });
});
