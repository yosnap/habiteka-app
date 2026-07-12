/**
 * Frontera de confianza de la extracción de bocetos: lo inválido se descarta
 * sin fallar, lo válido pasa intacto.
 */
import { describe, expect, it } from 'vitest';
import { parseRawSketch, sketchPrompt } from '@/server/ai/sketch/extract-sketch-geometry';

describe('parseRawSketch', () => {
  it('devuelve vacío ante salida no estructurada', () => {
    for (const bad of [null, undefined, 'texto', 42, []]) {
      const r = parseRawSketch(bad);
      expect(r.muros).toEqual([]);
      expect(r.aberturas).toEqual([]);
      expect(r.habitaciones).toEqual([]);
    }
  });

  it('acepta muros válidos y descarta coordenadas fuera de [0,1] o degeneradas', () => {
    const r = parseRawSketch({
      muros: [
        { x1: 0.1, y1: 0.1, x2: 0.9, y2: 0.1 }, // válido
        { x1: -0.2, y1: 0, x2: 0.5, y2: 0.5 }, // fuera de rango
        { x1: 0.3, y1: 0.3, x2: 0.3, y2: 0.3 }, // degenerado (punto)
        { x1: 0.1, y1: 'no', x2: 0.5, y2: 0.5 }, // tipo inválido
      ],
      aberturas: [],
      habitaciones: [],
    });
    expect(r.muros).toEqual([{ x1: 0.1, y1: 0.1, x2: 0.9, y2: 0.1 }]);
  });

  it('descarta aberturas con tipo desconocido, índice de muro inexistente o posición inválida', () => {
    const r = parseRawSketch({
      muros: [{ x1: 0, y1: 0, x2: 1, y2: 0 }],
      aberturas: [
        { tipo: 'puerta', muro: 0, posicion: 0.5, anchoSobreMuro: 0.2 }, // válida
        { tipo: 'portón', muro: 0, posicion: 0.5 }, // tipo desconocido
        { tipo: 'ventana', muro: 3, posicion: 0.5 }, // muro inexistente
        { tipo: 'ventana', muro: 0, posicion: 1.5 }, // posición fuera de rango
        { tipo: 'hueco', muro: 0.5, posicion: 0.5 }, // índice no entero
      ],
      habitaciones: [],
    });
    expect(r.aberturas).toEqual([{ tipo: 'puerta', muro: 0, posicion: 0.5, anchoSobreMuro: 0.2 }]);
  });

  it('descarta habitaciones sin nombre o con polígono de menos de 3 puntos', () => {
    const r = parseRawSketch({
      muros: [],
      aberturas: [],
      habitaciones: [
        { nombre: 'Salón', poligono: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }] },
        { nombre: '', poligono: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }] },
        { nombre: 'Pasillo', poligono: [{ x: 0, y: 0 }, { x: 1, y: 0 }] },
      ],
    });
    expect(r.habitaciones).toHaveLength(1);
    expect(r.habitaciones[0]!.nombre).toBe('Salón');
  });

  it('acepta escala plausible y descarta valores absurdos', () => {
    const base = { muros: [], aberturas: [], habitaciones: [] };
    expect(parseRawSketch({ ...base, anchoMetros: 8.5 }).anchoMetros).toBe(8.5);
    expect(parseRawSketch({ ...base, anchoMetros: 0.2 }).anchoMetros).toBeUndefined();
    expect(parseRawSketch({ ...base, anchoMetros: 5000 }).anchoMetros).toBeUndefined();
    expect(parseRawSketch({ ...base, anchoMetros: -3 }).anchoMetros).toBeUndefined();
  });

  it('escalaFiable solo se acepta con una escala válida que respaldarla', () => {
    const base = { muros: [], aberturas: [], habitaciones: [] };
    expect(parseRawSketch({ ...base, anchoMetros: 8, escalaFiable: true }).escalaFiable).toBe(true);
    // Fiabilidad declarada sin escala (o con escala descartada): no vale.
    expect(parseRawSketch({ ...base, escalaFiable: true }).escalaFiable).toBeUndefined();
    expect(
      parseRawSketch({ ...base, anchoMetros: 5000, escalaFiable: true }).escalaFiable,
    ).toBeUndefined();
    expect(parseRawSketch({ ...base, anchoMetros: 8 }).escalaFiable).toBeUndefined();
  });
});

describe('sketchPrompt', () => {
  it('pide geometría normalizada y prohíbe inventar elementos', () => {
    const p = sketchPrompt();
    expect(p).toContain('0–1');
    expect(p).toContain('No inventes');
  });
});
