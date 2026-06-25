import { describe, it, expect } from 'vitest';
import { objectCenterY, isFloorCollidable } from '@/canvas/3d/placement';
import { DEFAULT_CEILING_M } from '@/canvas/scale';

const CEILING = DEFAULT_CEILING_M; // 2.5 m

// Helper para construir objetos mínimos
function obj(
  kind: Parameters<typeof objectCenterY>[0]['kind'],
  opts: { heightM?: number; elevationM?: number } = {},
) {
  return { kind, heightM: opts.heightM, elevationM: opts.elevationM };
}

describe('objectCenterY — floor objects', () => {
  it('sofá en suelo → centro = altura_típica/2', () => {
    // sofa TYPICAL_HEIGHT_M = 0.85
    const y = objectCenterY(obj('sofa'), CEILING);
    expect(y).toBeCloseTo(0.85 / 2, 3);
  });

  it('sofá con elevationM=0.3 → centro = 0.3 + height/2', () => {
    const y = objectCenterY(obj('sofa', { elevationM: 0.3 }), CEILING);
    expect(y).toBeCloseTo(0.3 + 0.85 / 2, 3);
  });

  it('con heightM explícito usa ese valor', () => {
    const y = objectCenterY(obj('sofa', { heightM: 1.0 }), CEILING);
    expect(y).toBeCloseTo(0.5, 3);
  });

  it('vitrocerámica (elevationM=0.85) → apoyada sobre encimera', () => {
    // TYPICAL_HEIGHT_M.vitroceramica = 0.05
    const y = objectCenterY(obj('vitroceramica', { elevationM: 0.85 }), CEILING);
    expect(y).toBeCloseTo(0.85 + 0.05 / 2, 3);
  });
});

describe('objectCenterY — ceiling objects', () => {
  it('plafón LED (ceiling_light) → pegado al techo, cuelga hm/2 desde él', () => {
    // TYPICAL_HEIGHT_M.ceiling_light = 0.12; elevationM ausente = 0
    const y = objectCenterY(obj('ceiling_light'), CEILING);
    expect(y).toBeCloseTo(CEILING - 0.12 / 2, 3);
  });

  it('colgante (pendant_lamp) con elevationM=0.3 → cuelga 0.3 + hm/2 del techo', () => {
    // TYPICAL_HEIGHT_M.pendant_lamp = 0.4
    const y = objectCenterY(obj('pendant_lamp', { elevationM: 0.3 }), CEILING);
    expect(y).toBeCloseTo(CEILING - 0.3 - 0.4 / 2, 3);
  });

  it('recessed_light con elevationM=0 → enrasado al techo (y = ceilingH - hm/2)', () => {
    // heightM=0.05 para un foco empotrado
    const y = objectCenterY(obj('ceiling_light', { heightM: 0.05 }), CEILING);
    expect(y).toBeCloseTo(CEILING - 0.05 / 2, 3);
  });

  it('con ceilingHeightM=3.0 re-calcula correctamente', () => {
    const y = objectCenterY(obj('ceiling_light'), 3.0);
    expect(y).toBeCloseTo(3.0 - 0.12 / 2, 3);
  });
});

describe('objectCenterY — wall-child (puertas/ventanas)', () => {
  it('puerta → misma lógica que floor (base en suelo)', () => {
    // door usa altura de techo (usaAlturaDeTecho=true)
    const y = objectCenterY(obj('door'), CEILING);
    expect(y).toBeCloseTo(CEILING / 2, 3); // centro entre suelo y techo
  });
});

describe('isFloorCollidable', () => {
  it('sofá en suelo → colisionable', () => {
    expect(isFloorCollidable(obj('sofa'))).toBe(true);
  });

  it('sofá elevado > 10 cm → no colisionable (sobre encimera)', () => {
    expect(isFloorCollidable(obj('sofa', { elevationM: 0.85 }))).toBe(false);
  });

  it('ceiling_light → no colisionable (placement = ceiling)', () => {
    expect(isFloorCollidable(obj('ceiling_light'))).toBe(false);
  });

  it('door → no colisionable (placement = wall-child)', () => {
    expect(isFloorCollidable(obj('door'))).toBe(false);
  });

  it('cama en suelo (elevationM=0) → colisionable', () => {
    expect(isFloorCollidable(obj('cama', { elevationM: 0 }))).toBe(true);
  });
});
