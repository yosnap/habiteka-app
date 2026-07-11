/**
 * Normalización determinista del boceto: ortogonalizar, cerrar esquinas,
 * escalar a mm y anclar aberturas dentro de su muro.
 */
import { describe, expect, it } from 'vitest';
import { normalizeSketch } from '@/server/ai/sketch/normalize-geometry';
import type { RawSketch } from '@/server/ai/sketch/sketch-types';

const emptySketch: RawSketch = { muros: [], aberturas: [], habitaciones: [] };

describe('normalizeSketch', () => {
  it('endereza un trazo casi horizontal y respeta una diagonal intencionada', () => {
    const plano = normalizeSketch({
      ...emptySketch,
      anchoMetros: 10,
      altoMetros: 10,
      muros: [
        { x1: 0.1, y1: 0.5, x2: 0.9, y2: 0.53 }, // casi horizontal (≈2°)
        { x1: 0.1, y1: 0.1, x2: 0.6, y2: 0.6 }, // diagonal a 45°
      ],
    });
    const [horizontal, diagonal] = plano.zones[0]!.walls;
    expect(horizontal!.from.y).toBe(horizontal!.to.y);
    expect(diagonal!.from.y).not.toBe(diagonal!.to.y);
    expect(diagonal!.from.x).not.toBe(diagonal!.to.x);
  });

  it('cierra esquinas: extremos cercanos acaban en el mismo punto', () => {
    // Dos muros en L cuyo vértice común quedó abierto por 0.02 (< snap 0.03).
    const plano = normalizeSketch({
      ...emptySketch,
      anchoMetros: 10,
      altoMetros: 10,
      muros: [
        { x1: 0.1, y1: 0.1, x2: 0.5, y2: 0.1 },
        { x1: 0.51, y1: 0.12, x2: 0.51, y2: 0.5 },
      ],
    });
    const [a, b] = plano.zones[0]!.walls;
    expect(a!.to).toEqual(b!.from);
  });

  it('escala a milímetros con el ancho declarado y usa 8 m si no hay escala', () => {
    const muros = [{ x1: 0, y1: 0, x2: 1, y2: 0 }];
    const conEscala = normalizeSketch({ ...emptySketch, anchoMetros: 12, muros });
    expect(conEscala.zones[0]!.walls[0]!.to.x).toBe(12000);

    const sinEscala = normalizeSketch({ ...emptySketch, muros });
    expect(sinEscala.zones[0]!.walls[0]!.to.x).toBe(8000);
  });

  it('descarta trazos de ruido (más cortos que la longitud mínima)', () => {
    const plano = normalizeSketch({
      ...emptySketch,
      muros: [
        { x1: 0.1, y1: 0.1, x2: 0.9, y2: 0.1 },
        { x1: 0.5, y1: 0.5, x2: 0.505, y2: 0.5 }, // 0.005 < 0.02
      ],
    });
    expect(plano.zones[0]!.walls).toHaveLength(1);
  });

  it('ancla la abertura a su muro con ancho en mm y centro acotado para que quepa', () => {
    const plano = normalizeSketch({
      ...emptySketch,
      anchoMetros: 10,
      muros: [{ x1: 0, y1: 0, x2: 0.4, y2: 0 }], // muro de 4 m
      aberturas: [
        { tipo: 'puerta', muro: 0, posicion: 0.5, anchoSobreMuro: 0.25 }, // 1 m
        { tipo: 'ventana', muro: 0, posicion: 1 }, // pegada al extremo: debe entrar
      ],
    });
    const zone = plano.zones[0]!;
    const [puerta, ventana] = zone.apertures;
    expect(puerta!.widthMm).toBe(1000);
    expect(puerta!.position).toBe(0.5);
    expect(puerta!.wallId).toBe(zone.walls[0]!.id);
    // Ventana por defecto 1200 mm en muro de 4000: mitad = 0.15 → centro ≤ 0.85.
    expect(ventana!.widthMm).toBe(1200);
    expect(ventana!.position).toBeCloseTo(0.85, 5);
  });

  it('la abertura de un muro descartado desaparece con él', () => {
    const plano = normalizeSketch({
      ...emptySketch,
      muros: [{ x1: 0.5, y1: 0.5, x2: 0.505, y2: 0.5 }], // ruido
      aberturas: [{ tipo: 'puerta', muro: 0, posicion: 0.5 }],
    });
    expect(plano.zones[0]!.apertures).toEqual([]);
  });

  it('genera una cota por muro con la longitud en metros', () => {
    const plano = normalizeSketch({
      ...emptySketch,
      anchoMetros: 10,
      altoMetros: 10,
      muros: [{ x1: 0.1, y1: 0.2, x2: 0.42, y2: 0.2 }], // 3.2 m
    });
    expect(plano.zones[0]!.dimensions[0]!.label).toBe('3.20 m');
  });

  it('sin habitaciones: una única zona con contorno de respaldo', () => {
    const plano = normalizeSketch({
      ...emptySketch,
      anchoMetros: 10,
      altoMetros: 10,
      muros: [
        { x1: 0.1, y1: 0.1, x2: 0.9, y2: 0.1 },
        { x1: 0.9, y1: 0.1, x2: 0.9, y2: 0.9 },
      ],
    });
    expect(plano.zones).toHaveLength(1);
    expect(plano.zones[0]!.name).toBe('Estancia');
    expect(plano.zones[0]!.outline).toHaveLength(4);
  });

  it('con habitaciones: reparte cada muro a la zona de centroide más cercano', () => {
    // Dos salas lado a lado; un muro claramente en cada mitad.
    const plano = normalizeSketch({
      ...emptySketch,
      anchoMetros: 10,
      altoMetros: 10,
      muros: [
        { x1: 0, y1: 0, x2: 0.4, y2: 0 }, // mitad izquierda
        { x1: 0.6, y1: 1, x2: 1, y2: 1 }, // mitad derecha
      ],
      aberturas: [{ tipo: 'puerta', muro: 1, posicion: 0.5 }],
      habitaciones: [
        {
          nombre: 'Cocina',
          poligono: [{ x: 0, y: 0 }, { x: 0.5, y: 0 }, { x: 0.5, y: 1 }, { x: 0, y: 1 }],
        },
        {
          nombre: 'Salón',
          poligono: [{ x: 0.5, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0.5, y: 1 }],
        },
      ],
    });
    const cocina = plano.zones.find((z) => z.name === 'Cocina')!;
    const salon = plano.zones.find((z) => z.name === 'Salón')!;
    expect(cocina.walls).toHaveLength(1);
    expect(salon.walls).toHaveLength(1);
    // La puerta viaja con su muro (el de la derecha).
    expect(salon.apertures).toHaveLength(1);
    expect(cocina.apertures).toHaveLength(0);
    // Cada zona lleva las cotas de sus muros.
    expect(cocina.dimensions).toHaveLength(1);
    expect(salon.dimensions).toHaveLength(1);
  });

  it('es determinista: la misma extracción produce el mismo plano', () => {
    const raw: RawSketch = {
      anchoMetros: 9,
      muros: [
        { x1: 0.1, y1: 0.1, x2: 0.88, y2: 0.12 },
        { x1: 0.9, y1: 0.1, x2: 0.9, y2: 0.9 },
      ],
      aberturas: [{ tipo: 'puerta', muro: 0, posicion: 0.3 }],
      habitaciones: [],
    };
    expect(normalizeSketch(raw)).toEqual(normalizeSketch(raw));
  });
});
