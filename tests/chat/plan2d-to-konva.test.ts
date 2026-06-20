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
