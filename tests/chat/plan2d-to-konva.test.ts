import { describe, it, expect } from 'vitest';
import { planToPrimitives } from '@/components/deliverables/plan2d-to-konva';
import { DELIVERABLE_LEGAL_SEAL } from '@/lib/legal-text';
import type { Plano2dPayload } from '@/lib/contracts';

const plano: Plano2dPayload = {
  schemaVersion: 1,
  zones: [
    {
      id: 'salon',
      name: 'Salón',
      outline: [
        { x: 0, y: 0 },
        { x: 4000, y: 0 },
        { x: 4000, y: 3000 },
        { x: 0, y: 3000 },
      ],
      walls: [{ id: 'w1', from: { x: 0, y: 0 }, to: { x: 4000, y: 0 }, thicknessMm: 120 }],
      apertures: [],
      dimensions: [],
    },
  ],
};

describe('planToPrimitives — proyección del plano a primitivas', () => {
  it('escala las paredes para encajar en el área manteniendo proporción', () => {
    const out = planToPrimitives(plano, { width: 800, height: 600 });
    expect(out.walls).toHaveLength(1);
    // El plano mide 4000×3000; el área 800×600 → escala 0.2 (limita el ancho).
    expect(out.scale).toBeCloseTo(0.2, 5);
    expect(out.walls[0]?.points).toHaveLength(4);
  });

  it('un plano sin zonas no produce paredes ni NaN', () => {
    const empty: Plano2dPayload = { schemaVersion: 1, zones: [] };
    const out = planToPrimitives(empty, { width: 800, height: 600 });
    expect(out.walls).toHaveLength(0);
    expect(Number.isFinite(out.scale)).toBe(true);
  });

  it('el sello legal es el texto único compartido (presente en el export del viewer)', () => {
    // El viewer estampa este texto DENTRO del stage; aquí se verifica la fuente.
    expect(DELIVERABLE_LEGAL_SEAL).toContain('Habiteka AI');
    expect(DELIVERABLE_LEGAL_SEAL).toContain('Revisión técnica requerida');
  });
});

it('omite zonas sin geometría en vez de romper y lo indica con la lista de dibujables', async () => {
  const { drawableZones } = await import('@/components/deliverables/plan2d-to-konva');
  const broken = { schemaVersion: 1, zones: [{}, {}, {}] } as unknown as Parameters<typeof planToPrimitives>[0];
  expect(() => planToPrimitives(broken, { width: 400, height: 300 })).not.toThrow();
  expect(drawableZones(broken)).toHaveLength(0);
  expect(planToPrimitives(broken, { width: 400, height: 300 }).walls).toHaveLength(0);
});

describe('planToPrimitives — huecos y rótulos', () => {
  it('proyecta cada hueco como un tramo de su muro y rotula la estancia en su centro', () => {
    const withAperture: Plano2dPayload = {
      ...plano,
      zones: [{
        ...plano.zones[0]!,
        apertures: [
          { id: 'v1', kind: 'ventana', wallId: 'w1', position: 0.5, widthMm: 1000 },
          { id: 'x', kind: 'puerta', wallId: 'inexistente', position: 0.5, widthMm: 900 },
        ],
      }],
    };
    const out = planToPrimitives(withAperture, { width: 400, height: 300 });
    expect(out.apertures).toHaveLength(1);
    const [x1, , x2] = out.apertures[0]!.points;
    // 1000 mm de un muro de 4000 mm, centrado: un cuarto del ancho del muro.
    expect(x2! - x1!).toBeCloseTo(1000 * out.scale);
    expect(out.labels).toEqual([{ text: 'Salón', x: expect.any(Number), y: expect.any(Number) }]);
  });
});
