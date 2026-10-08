/**
 * Frontera de confianza de la extracción de bocetos: lo inválido se descarta
 * sin fallar, lo válido pasa intacto.
 */
import { describe, expect, it } from 'vitest';
import { parseRawSketch, planPrompt, sketchPrompt } from '@/server/ai/sketch/extract-sketch-geometry';

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

  it('conserva giro y bisagra observados solo en puertas y descarta valores desconocidos', () => {
    const r = parseRawSketch({
      muros: [{ x1: 0, y1: 0, x2: 1, y2: 0 }], habitaciones: [],
      aberturas: [
        { tipo: 'puerta', muro: 0, posicion: 0.3, swing: 'right', hinge: 'right', arcVisible: true },
        { tipo: 'puerta', muro: 0, posicion: 0.7, swing: 'afuera', hinge: 'left', arcVisible: 'sí' },
        { tipo: 'ventana', muro: 0, posicion: 0.5, swing: 'left', hinge: 'right', arcVisible: true },
      ],
    });
    expect(r.aberturas).toEqual([
      { tipo: 'puerta', muro: 0, posicion: 0.3, swing: 'right', hinge: 'right', arcVisible: true },
      { tipo: 'puerta', muro: 0, posicion: 0.7, hinge: 'left' },
      { tipo: 'ventana', muro: 0, posicion: 0.5 },
    ]);
    expect(sketchPrompt()).toContain('no los deduzcas del nombre');
    // Con todos los decimales, un plano con mucho mobiliario no cabía en la respuesta.
    expect(planPrompt()).toContain('3 decimales como máximo');
    // La abatible exige el arco; la corredera y la plegable se reconocen por su hoja.
    expect(sketchPrompt()).toContain('Una PUERTA abatible exige ver el arco');
    expect(sketchPrompt()).toContain('Es tipo=puerta aunque no tenga arco');
  });

  it('sanea los tres puntos de un arco antes de usarlos para situar la puerta', () => {
    const valid = {
      hinge: { x: 0.5, y: 0.3 }, openingEnd: { x: 0.5, y: 0.38 },
      arcPoint: { x: 0.58, y: 0.3 },
    };
    const r = parseRawSketch({
      muros: [{ x1: 0.2, y1: 0.2, x2: 0.8, y2: 0.2 }], habitaciones: [],
      aberturas: [
        { tipo: 'puerta', muro: 0, posicion: 0.5, arcVisible: true, arcGeometry: valid },
        { tipo: 'puerta', muro: 0, posicion: 0.7, arcVisible: true,
          arcGeometry: { ...valid, arcPoint: { x: 0.99, y: 0.99 } } },
      ],
    });
    expect(r.aberturas[0]?.arcGeometry).toEqual(valid);
    expect(r.aberturas[1]?.arcGeometry).toBeUndefined();
    expect(sketchPrompt()).toContain('arcGeometry');
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

describe('parseRawSketch — plano dibujado (cotas, mobiliario, exteriores)', () => {
  const base = { muros: [], aberturas: [] };
  const tri = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }];

  it('sanea el nombre de estancia y acepta medidas escritas plausibles', () => {
    const r = parseRawSketch({
      ...base,
      habitaciones: [
        { nombre: 'Dorm.<b>Principal</b>', poligono: tri, anchoMetros: 3, altoMetros: 4, exterior: false },
        { nombre: 'Terraza', poligono: tri, exterior: true, areaM2: 22.5 },
        { nombre: 'Mal', poligono: tri, anchoMetros: 0.1, altoMetros: 500 },
      ],
    });
    expect(r.habitaciones[0]).toEqual({
      nombre: 'Dorm. b Principal /b', poligono: tri, anchoMetros: 3, altoMetros: 4,
    });
    expect(r.habitaciones[1]).toEqual({ nombre: 'Terraza', poligono: tri, exterior: true, areaM2: 22.5 });
    expect(r.habitaciones[2]).toEqual({ nombre: 'Mal', poligono: tri });
  });

  it('acepta cotas con 1 o 2 valores, tipo válido y ancla en rango; descarta el resto', () => {
    const r = parseRawSketch({
      ...base,
      habitaciones: [],
      cotas: [
        { texto: '15.20 m', valoresMetros: [15.2], tipo: 'general', ancla: { x: 0.5, y: 0.02 } },
        { texto: '3.00 x 3.40 m', valoresMetros: [3, 3.4], tipo: 'estancia', ancla: { x: 0.2, y: 0.3 } },
        { texto: 'x', valoresMetros: [], tipo: 'general', ancla: { x: 0.5, y: 0.5 } },
        { texto: '1 2 3', valoresMetros: [1, 2, 3], tipo: 'general', ancla: { x: 0.5, y: 0.5 } },
        { texto: '5', valoresMetros: [5], tipo: 'raro', ancla: { x: 0.5, y: 0.5 } },
        { texto: '5', valoresMetros: [5], tipo: 'general', ancla: { x: 2, y: 0.5 } },
      ],
    });
    expect(r.cotas).toHaveLength(2);
    expect(r.cotas![1]!.valoresMetros).toEqual([3, 3.4]);
  });

  it('acepta mobiliario del vocabulario con caja válida y cuantiza el giro a 90°', () => {
    const r = parseRawSketch({
      ...base,
      habitaciones: [],
      mobiliario: [
        { tipo: 'bed', bbox: { minX: 0.1, minY: 0.1, maxX: 0.3, maxY: 0.35 }, rotacionDeg: 87, etiqueta: 'Cama' },
        { tipo: 'sofa', bbox: { minX: 0.5, minY: 0.5, maxX: 0.5, maxY: 0.6 }, rotacionDeg: 0 },
        { tipo: 'dragon', bbox: { minX: 0.1, minY: 0.1, maxX: 0.3, maxY: 0.3 }, rotacionDeg: 0 },
        { tipo: 'table', bbox: { minX: 0.1, minY: 0.1, maxX: 0.3, maxY: 0.3 }, rotacionDeg: -90 },
      ],
    });
    expect(r.mobiliario).toEqual([
      { tipo: 'bed', bbox: { minX: 0.1, minY: 0.1, maxX: 0.3, maxY: 0.35 }, rotacionDeg: 90, etiqueta: 'Cama' },
      { tipo: 'table', bbox: { minX: 0.1, minY: 0.1, maxX: 0.3, maxY: 0.3 }, rotacionDeg: 270 },
    ]);
  });

  it('sin campos de plano, no añade claves cotas/mobiliario', () => {
    const r = parseRawSketch({ ...base, habitaciones: [] });
    expect('cotas' in r).toBe(false);
    expect('mobiliario' in r).toBe(false);
  });
});

describe('planPrompt', () => {
  it('pide cotas, medidas por estancia, exteriores y mobiliario sin inventar', () => {
    const p = planPrompt();
    expect(p).toContain('cotas');
    expect(p).toContain('exterior=true');
    expect(p).toContain('mobiliario');
    expect(p).toContain('No inventes');
    expect(p).not.toContain('Ignora mobiliario');
  });
});
