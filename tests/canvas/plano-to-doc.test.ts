/**
 * Conversión del plano métrico a objetos editables del canvas: escala px↔mm,
 * traslado al origen, anclaje de aberturas y referencia parentId.
 */
import { describe, expect, it } from 'vitest';
import { planoToDoc } from '@/canvas/plano-to-doc';
import type { Plano2dPayload } from '@/lib/contracts';

function planoWith(overrides: Partial<Plano2dPayload['zones'][number]> = {}): Plano2dPayload {
  return {
    schemaVersion: 1,
    zones: [
      {
        id: 'z0',
        name: 'Estancia',
        outline: [],
        walls: [{ id: 'w0', from: { x: 0, y: 0 }, to: { x: 4000, y: 0 }, thicknessMm: 120 }],
        apertures: [],
        dimensions: [],
        ...overrides,
      },
    ],
  };
}

describe('planoToDoc', () => {
  it('convierte un muro de 4 m a 400 px (100 px/m) con grosor de 12 px', () => {
    const { objects, scale } = planoToDoc(planoWith());
    expect(scale.pxPerMeter).toBe(100);
    const wall = objects.find((o) => o.kind === 'wall')!;
    expect(wall.width).toBe(400);
    expect(wall.height).toBe(12);
    expect(wall.rotation).toBe(0);
  });

  it('traslada el plano al origen pedido (el mm mínimo aterriza en originPx)', () => {
    // Plano que empieza en (2000, 1000) mm: no debe aterrizar fuera de pantalla.
    const { objects } = planoToDoc(
      planoWith({
        walls: [{ id: 'w0', from: { x: 2000, y: 1000 }, to: { x: 6000, y: 1000 }, thicknessMm: 120 }],
      }),
      { originPx: { x: 50, y: 50 } },
    );
    const wall = objects.find((o) => o.kind === 'wall')!;
    // Eje en y=50; la esquina del muro queda medio grosor por encima.
    expect(wall.x).toBe(50);
    expect(wall.y).toBe(50 - wall.height / 2);
  });

  it('ancla la puerta centrada en su muro, con parentId y el grosor del muro', () => {
    const { objects } = planoToDoc(
      planoWith({
        apertures: [{ id: 'a0', kind: 'puerta', wallId: 'w0', position: 0.5, widthMm: 1000 }],
      }),
      { originPx: { x: 80, y: 80 } },
    );
    const wall = objects.find((o) => o.kind === 'wall')!;
    const door = objects.find((o) => o.kind === 'door')!;
    expect(door.parentId).toBe(wall.id);
    expect(door.width).toBe(100);
    expect(door.height).toBe(wall.height);
    expect(door.rotation).toBe(0);
    // Centro del muro en x = 80 + 200; esquina de la puerta = centro − 50.
    expect(door.x).toBe(230);
    // Pegada al eje del muro: media altura por encima.
    expect(door.y).toBe(80 - wall.height / 2);
  });

  it('mapea ventana → window y hueco → door (kind más cercano del catálogo)', () => {
    const { objects } = planoToDoc(
      planoWith({
        apertures: [
          { id: 'a0', kind: 'ventana', wallId: 'w0', position: 0.25, widthMm: 1200 },
          { id: 'a1', kind: 'hueco', wallId: 'w0', position: 0.75, widthMm: 800 },
        ],
      }),
    );
    expect(objects.filter((o) => o.kind === 'window')).toHaveLength(1);
    expect(objects.filter((o) => o.kind === 'door')).toHaveLength(1);
  });

  it('una abertura cuyo muro no existe se omite sin romper el resto', () => {
    const { objects } = planoToDoc(
      planoWith({
        apertures: [{ id: 'a0', kind: 'puerta', wallId: 'no-existe', position: 0.5, widthMm: 900 }],
      }),
    );
    expect(objects).toHaveLength(1); // solo el muro
  });

  it('genera ids únicos entre llamadas (UUID, no contador)', () => {
    const a = planoToDoc(planoWith()).objects[0]!.id;
    const b = planoToDoc(planoWith()).objects[0]!.id;
    expect(a).not.toBe(b);
  });
});
