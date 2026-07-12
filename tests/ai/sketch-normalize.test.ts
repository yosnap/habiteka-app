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

  it('sanea una escala implausible: un piso con estancias no mide 2 m de ancho', () => {
    // El modelo estimó 2 m de ancho total para un plano con 3 habitaciones:
    // el saneo reescala a un tamaño creíble (~10 m de lado mayor).
    const room = (nombre: string, x0: number) => ({
      nombre,
      poligono: [
        { x: x0, y: 0 },
        { x: x0 + 0.3, y: 0 },
        { x: x0 + 0.3, y: 1 },
        { x: x0, y: 1 },
      ],
    });
    const plano = normalizeSketch({
      anchoMetros: 2,
      altoMetros: 2,
      muros: [
        { x1: 0, y1: 0, x2: 1, y2: 0 },
        { x1: 0, y1: 1, x2: 1, y2: 1 },
      ],
      aberturas: [],
      habitaciones: [room('Dormitorio', 0), room('Salón', 0.35), room('Cocina', 0.7)],
    });
    const wall = plano.zones.flatMap((z) => z.walls)[0]!;
    const widthM = Math.abs(wall.to.x - wall.from.x) / 1000;
    expect(widthM).toBeGreaterThanOrEqual(7);
  });

  it('deduplica aberturas casi en el mismo punto del mismo muro', () => {
    const plano = normalizeSketch({
      ...emptySketch,
      anchoMetros: 10,
      muros: [{ x1: 0, y1: 0, x2: 0.4, y2: 0 }],
      aberturas: [
        { tipo: 'puerta', muro: 0, posicion: 0.5 },
        { tipo: 'puerta', muro: 0, posicion: 0.52 }, // duplicado (a 8 cm)
        { tipo: 'ventana', muro: 0, posicion: 0.15 }, // distinta de verdad
      ],
    });
    expect(plano.zones[0]!.apertures).toHaveLength(2);
  });

  it('funde caras dobles y tramos troceados antes de acotar', () => {
    // Un muro grueso devuelto como dos caras + un muro recto troceado en dos.
    const plano = normalizeSketch({
      ...emptySketch,
      anchoMetros: 10,
      altoMetros: 10,
      muros: [
        { x1: 0.1, y1: 0.5, x2: 0.9, y2: 0.5 },
        { x1: 0.1, y1: 0.52, x2: 0.9, y2: 0.52 }, // cara doble del anterior
        { x1: 0.1, y1: 0.1, x2: 0.5, y2: 0.1 },
        { x1: 0.5, y1: 0.1, x2: 0.9, y2: 0.1 }, // continuación colineal
      ],
    });
    expect(plano.zones[0]!.walls).toHaveLength(2);
  });

  it('no acota fragmentos interiores cortos: solo muros exteriores largos', () => {
    const plano = normalizeSketch({
      ...emptySketch,
      anchoMetros: 10,
      altoMetros: 10,
      muros: [
        { x1: 0, y1: 0, x2: 1, y2: 0 }, // exterior 10 m → con cota
        { x1: 0, y1: 1, x2: 1, y2: 1 }, // exterior 10 m → con cota
        { x1: 0.45, y1: 0.48, x2: 0.55, y2: 0.48 }, // fragmento interior 1 m → sin cota
      ],
    });
    const dims = plano.zones.flatMap((z) => z.dimensions);
    expect(dims).toHaveLength(2);
  });

  it('un muro fusionado de tramos con desfase queda vertical, no torcido', () => {
    // Dos tramos verticales casi colineales (desfase 0.005) que comparten
    // extremo: la fusión inclinaría el muro; el re-alineado lo endereza.
    const plano = normalizeSketch({
      ...emptySketch,
      anchoMetros: 10,
      altoMetros: 10,
      muros: [
        { x1: 0.5, y1: 0.1, x2: 0.5, y2: 0.5 },
        { x1: 0.505, y1: 0.5, x2: 0.505, y2: 0.9 },
      ],
    });
    const wall = plano.zones[0]!.walls[0]!;
    expect(plano.zones[0]!.walls).toHaveLength(1);
    expect(wall.from.x).toBe(wall.to.x);
  });

  it('descarta diagonales cortos (arcos de puerta leídos como muros)', () => {
    const plano = normalizeSketch({
      ...emptySketch,
      anchoMetros: 10,
      altoMetros: 10,
      muros: [
        { x1: 0.1, y1: 0.1, x2: 0.9, y2: 0.1 }, // muro real
        { x1: 0.4, y1: 0.4, x2: 0.44, y2: 0.44 }, // trocito de arco a 45°
        { x1: 0.5, y1: 0.5, x2: 0.9, y2: 0.9 }, // chaflán largo real: se queda
      ],
    });
    expect(plano.zones[0]!.walls).toHaveLength(2);
  });

  it('cierra juntas en T: el tabique llega hasta el muro perimetral', () => {
    const plano = normalizeSketch({
      ...emptySketch,
      anchoMetros: 10,
      altoMetros: 10,
      muros: [
        { x1: 0.1, y1: 0.1, x2: 0.9, y2: 0.1 }, // perimetral
        { x1: 0.5, y1: 0.135, x2: 0.5, y2: 0.9 }, // tabique que se queda corto
      ],
    });
    const [perimetral, tabique] = plano.zones[0]!.walls;
    expect(tabique!.from.y).toBe(perimetral!.from.y);
  });

  it('con wallsOverride usa los muros de píxeles y ancla las aberturas del modelo', () => {
    const plano = normalizeSketch(
      {
        ...emptySketch,
        anchoMetros: 10,
        altoMetros: 10,
        // Muros del MODELO, desplazados (coordenadas "a ojo").
        muros: [{ x1: 0.15, y1: 0.32, x2: 0.85, y2: 0.32 }],
        // La puerta referencia el muro del modelo; debe acabar sobre el muro real.
        aberturas: [{ tipo: 'puerta', muro: 0, posicion: 0.5 }],
      },
      {
        // Muros DETECTADOS por píxeles: el de verdad está en y=0.3, partido por
        // el vano de la puerta (hueco de 0.1 que el puenteo debe cerrar).
        wallsOverride: [
          { x1: 0.1, y1: 0.3, x2: 0.45, y2: 0.3 },
          { x1: 0.55, y1: 0.3, x2: 0.9, y2: 0.3 },
          { x1: 0.1, y1: 0.3, x2: 0.1, y2: 0.9 },
          { x1: 0.9, y1: 0.3, x2: 0.9, y2: 0.9 },
          { x1: 0.1, y1: 0.9, x2: 0.9, y2: 0.9 },
        ],
      },
    );
    const zone = plano.zones[0]!;
    // 4 muros finales: el horizontal superior puenteado + 2 verticales + inferior.
    expect(zone.walls).toHaveLength(4);
    const top = zone.walls.find((w) => w.from.y === w.to.y && w.from.y < 5000)!;
    expect(Math.abs(top.to.x - top.from.x)).toBe(8000); // 0.8 unidades × 10 m
    // La puerta del modelo quedó anclada al muro real puenteado.
    expect(zone.apertures).toHaveLength(1);
    expect(zone.apertures[0]!.wallId).toBe(top.id);
  });

  it('ruta de píxeles: huecos = aberturas exactas, puertas fantasma fuera, zonas desde regiones', () => {
    const plano = normalizeSketch(
      {
        anchoMetros: 10,
        altoMetros: 10,
        // Muros APROXIMADOS del modelo: solo sirven para situar sus semillas
        // de abertura; la geometría real viene de la medición (override).
        muros: [
          { x1: 0.5, y1: 0.12, x2: 0.5, y2: 0.88 }, // tabique, a ojo
          { x1: 0.12, y1: 0.1, x2: 0.88, y2: 0.1 }, // muro superior, a ojo
        ],
        aberturas: [
          // Semilla cerca del hueco real: aporta el TIPO (puerta).
          { tipo: 'puerta', muro: 0, posicion: 0.5 },
          // Puerta fantasma lejos de todo hueco: debe descartarse.
          { tipo: 'puerta', muro: 0, posicion: 0.1 },
          // Ventana en el perímetro sin hueco detectado: se conserva anclada.
          { tipo: 'ventana', muro: 1, posicion: 0.5 },
        ],
        habitaciones: [
          {
            nombre: 'Dormitorio',
            poligono: [
              { x: 0.15, y: 0.2 },
              { x: 0.4, y: 0.2 },
              { x: 0.4, y: 0.8 },
              { x: 0.15, y: 0.8 },
            ],
          },
          {
            nombre: 'Salón',
            poligono: [
              { x: 0.6, y: 0.2 },
              { x: 0.85, y: 0.2 },
              { x: 0.85, y: 0.8 },
              { x: 0.6, y: 0.8 },
            ],
          },
        ],
      },
      {
        wallsOverride: [
          // Perímetro cerrado.
          { x1: 0.1, y1: 0.1, x2: 0.9, y2: 0.1 },
          { x1: 0.9, y1: 0.1, x2: 0.9, y2: 0.9 },
          { x1: 0.9, y1: 0.9, x2: 0.1, y2: 0.9 },
          { x1: 0.1, y1: 0.9, x2: 0.1, y2: 0.1 },
          // Tabique central partido por el vano de una puerta.
          { x1: 0.5, y1: 0.1, x2: 0.5, y2: 0.45 },
          { x1: 0.5, y1: 0.55, x2: 0.5, y2: 0.9 },
        ],
      },
    );
    // Los muros del modelo eran para las semillas: la geometría es medida.
    // Aberturas: el hueco del tabique (puerta) + la ventana conservada = 2.
    const allApertures = plano.zones.flatMap((z) => z.apertures);
    expect(allApertures).toHaveLength(2);
    expect(allApertures.filter((a) => a.kind === 'puerta')).toHaveLength(1);
    expect(allApertures.filter((a) => a.kind === 'ventana')).toHaveLength(1);
    // La puerta cae en el centro del tabique puenteado (posición ≈ 0.5).
    const puerta = allApertures.find((a) => a.kind === 'puerta')!;
    expect(puerta.position).toBeGreaterThan(0.4);
    expect(puerta.position).toBeLessThan(0.6);

    // Zonas desde regiones: dos habitaciones con su nombre en el lado correcto.
    expect(plano.zones).toHaveLength(2);
    const dormitorio = plano.zones.find((z) => z.name === 'Dormitorio')!;
    const salon = plano.zones.find((z) => z.name === 'Salón')!;
    const centroidX = (z: typeof dormitorio) =>
      z.outline.reduce((acc, p) => acc + p.x, 0) / z.outline.length;
    expect(centroidX(dormitorio)).toBeLessThan(5000);
    expect(centroidX(salon)).toBeGreaterThan(5000);
  });

  it('con pocos muros de píxeles cae a los muros del modelo', () => {
    const plano = normalizeSketch(
      {
        ...emptySketch,
        anchoMetros: 10,
        muros: [{ x1: 0.1, y1: 0.5, x2: 0.9, y2: 0.5 }],
      },
      { wallsOverride: [{ x1: 0.2, y1: 0.2, x2: 0.8, y2: 0.2 }] }, // solo 1: no fiable
    );
    // Usa el muro del modelo (y=0.5), no el de píxeles (y=0.2).
    expect(plano.zones[0]!.walls[0]!.from.y).toBe(5000);
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
